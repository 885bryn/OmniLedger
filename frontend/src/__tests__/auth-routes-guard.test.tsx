// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { AuthProvider } from '../auth/auth-context'
import { RequireAuth } from '../auth/require-auth'
import { LoginPage } from '../pages/auth/login-page'

function createJsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function createDeferredResponse() {
  let resolve: ((value: Response) => void) | null = null
  const promise = new Promise<Response>((resolver) => {
    resolve = resolver
  })

  return {
    promise,
    resolve: (response: Response) => resolve?.(response),
  }
}

function LocationEcho() {
  const location = useLocation()
  return <p data-testid="location-echo">{`${location.pathname}${location.search}${location.hash}`}</p>
}

function renderAuthRouter(initialEntries: string[]) {
  const router = createMemoryRouter(
    [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/dashboard',
        element: <p>Dashboard</p>,
      },
      {
        path: '/items/:itemId/edit',
        element: (
          <RequireAuth>
            <p>Item edit page</p>
            <LocationEcho />
          </RequireAuth>
        ),
      },
    ],
    { initialEntries },
  )

  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

describe('auth routes and login guard flow', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    window.sessionStorage.clear()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('redirects unauthenticated deep links to login and restores exact route after successful login', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/auth/session') && method === 'GET') {
        return createJsonResponse(200, {
          user: null,
          session: { authenticated: false },
        })
      }

      if (url.includes('/auth/login') && method === 'POST') {
        return createJsonResponse(200, {
          user: { id: 'user-1', username: 'alpha', email: 'alpha@example.com' },
          session: { authenticated: true },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderAuthRouter(['/items/item-9/edit?tab=history#panel'])

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()

    await userEvent.type(screen.getByLabelText('Email'), 'alpha@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Item edit page')).toBeTruthy()
    expect(screen.getByTestId('location-echo').textContent).toBe('/items/item-9/edit?tab=history#panel')
  })

  it('keeps the signed-in dashboard route when the initial session probe resolves stale after login', async () => {
    const deferredSession = createDeferredResponse()

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/auth/session') && method === 'GET') {
        return deferredSession.promise
      }

      if (url.includes('/auth/login') && method === 'POST') {
        return createJsonResponse(200, {
          user: { id: 'user-1', username: 'alpha', email: 'alpha@example.com' },
          session: { authenticated: true },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const router = createMemoryRouter(
      [
        {
          path: '/login',
          element: <LoginPage />,
        },
        {
          path: '/dashboard',
          element: (
            <RequireAuth>
              <p>Dashboard</p>
            </RequireAuth>
          ),
        },
      ],
      { initialEntries: ['/login'] },
    )

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    )

    await userEvent.type(await screen.findByLabelText('Email'), 'alpha@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Dashboard')).toBeTruthy()

    deferredSession.resolve(
      createJsonResponse(200, {
        user: null,
        session: { authenticated: false },
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeTruthy()
    })
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull()
  })

  it('keeps email, clears password, and shows generic top plus inline feedback on failed sign-in', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/auth/session') && method === 'GET') {
        return createJsonResponse(200, {
          user: null,
          session: { authenticated: false },
        })
      }

      if (url.includes('/auth/login') && method === 'POST') {
        return createJsonResponse(401, {
          error: {
            code: 'invalid_credentials',
            message: 'Invalid email or password.',
            cooldown: null,
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderAuthRouter(['/login'])

    const emailInput = await screen.findByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')

    await userEvent.type(emailInput, 'alpha@example.com')
    await userEvent.type(passwordInput, 'WrongPass123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Sign-in failed. Check your credentials and try again.')
    expect((emailInput as HTMLInputElement).value).toBe('alpha@example.com')
    expect((passwordInput as HTMLInputElement).value).toBe('')
    expect(screen.getAllByText('Email and password are required for sign-in.').length).toBeGreaterThan(0)
  })

  it('enforces cooldown UX by disabling submit until retry window expires', async () => {
    const user = userEvent.setup()

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/auth/session') && method === 'GET') {
        return createJsonResponse(200, {
          user: null,
          session: { authenticated: false },
        })
      }

      if (url.includes('/auth/login') && method === 'POST') {
        return createJsonResponse(429, {
          error: {
            code: 'auth_cooldown',
            message: 'Too many failed sign in attempts. Please wait before trying again.',
            cooldown: {
              retry_after_seconds: 1,
            },
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderAuthRouter(['/login'])

    await user.type(await screen.findByLabelText('Email'), 'alpha@example.com')
    await user.type(screen.getByLabelText('Password'), 'WrongPass123!')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText(/Too many attempts/)).toBeTruthy()

    const submitButton = screen.getByRole('button', { name: 'Sign in' })
    expect(submitButton.hasAttribute('disabled')).toBe(true)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in' }).hasAttribute('disabled')).toBe(false)
    }, { timeout: 3500 })
  })
})
