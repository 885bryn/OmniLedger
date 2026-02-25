// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, sanitizeReturnTo } from '../auth/auth-context'
import { RequireAuth } from '../auth/require-auth'
import { AppShell } from '../app/shell/app-shell'
import '../lib/i18n'
import { apiRequest } from '../lib/api-client'
import { LoginPage } from '../pages/auth/login-page'

function createJsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function LocationEcho() {
  const location = useLocation()
  return <p data-testid="location-echo">{`${location.pathname}${location.search}${location.hash}`}</p>
}

function SessionProbePage() {
  return (
    <div>
      <p>Session probe</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await apiRequest('/items')
          } catch {
            return
          }
        }}
      >
        Trigger protected request
      </button>
      <LocationEcho />
    </div>
  )
}

function LoginRoute() {
  return (
    <>
      <LoginPage />
      <LocationEcho />
    </>
  )
}

function renderSessionExpiryRouter(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const router = createMemoryRouter(
    [
      {
        path: '/login',
        element: <LoginRoute />,
      },
      {
        path: '/',
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          {
            path: 'probe',
            element: <SessionProbePage />,
          },
        ],
      },
    ],
    { initialEntries },
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('session expiry redirect flow', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    window.sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('shows session-expired banner and redirects to login with encoded deep-link returnTo', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/auth/session') && method === 'GET') {
        return createJsonResponse(200, {
          user: { id: 'user-1', username: 'alpha', email: 'alpha@example.com' },
          session: { authenticated: true },
        })
      }

      if (url.includes('/users') && method === 'GET') {
        return createJsonResponse(200, {
          users: [{ id: 'user-1', username: 'alpha', email: 'alpha@example.com' }],
          total_count: 1,
        })
      }

      if (url.includes('/items') && method === 'GET') {
        return createJsonResponse(401, {
          error: {
            code: 'unauthorized',
            message: 'Unauthorized',
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderSessionExpiryRouter(['/probe?tab=history#panel'])

    await userEvent.click(await screen.findByRole('button', { name: 'Trigger protected request' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()

    const expectedReturnTo = sanitizeReturnTo('/probe?tab=history#panel')
    const locationValue = screen.getByTestId('location-echo').textContent ?? ''
    expect(locationValue.startsWith('/login?')).toBe(true)

    const query = new URLSearchParams(locationValue.split('?')[1] ?? '')
    expect(query.get('returnTo')).toBe(expectedReturnTo)
  })

  it('restores exact deep link after login following session-expired redirect', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/auth/session') && method === 'GET') {
        return createJsonResponse(200, {
          user: { id: 'user-1', username: 'alpha', email: 'alpha@example.com' },
          session: { authenticated: true },
        })
      }

      if (url.includes('/users') && method === 'GET') {
        return createJsonResponse(200, {
          users: [{ id: 'user-1', username: 'alpha', email: 'alpha@example.com' }],
          total_count: 1,
        })
      }

      if (url.includes('/items') && method === 'GET') {
        return createJsonResponse(401, {
          error: {
            code: 'unauthorized',
            message: 'Unauthorized',
          },
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

    renderSessionExpiryRouter(['/probe?tab=history#panel'])

    await userEvent.click(await screen.findByRole('button', { name: 'Trigger protected request' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()

    await userEvent.type(screen.getByLabelText('Email'), 'alpha@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Session probe')).toBeTruthy()
    expect(screen.getByTestId('location-echo').textContent).toBe('/probe?tab=history#panel')
  })
})
