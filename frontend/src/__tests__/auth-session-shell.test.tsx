// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/auth-context'
import { RequireAuth } from '../auth/require-auth'
import { AppShell } from '../app/shell/app-shell'
import '../lib/i18n'

function createJsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function renderShell(initialEntries: string[]) {
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
        element: <p>Sign in route</p>,
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
            path: 'dashboard',
            element: <p>Dashboard content</p>,
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

describe('auth session shell controls', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('renders authenticated session identity and removes actor selector semantics', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/auth/session') && method === 'GET') {
        return createJsonResponse(200, {
          user: { id: 'user-1', username: 'alpha', email: 'alpha@example.com' },
          session: { authenticated: true },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderShell(['/dashboard'])

    expect(await screen.findByText('Dashboard content')).toBeTruthy()
    expect(screen.getByText('Signed in as')).toBeTruthy()
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('logs out current session and routes to login', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/auth/session') && method === 'GET') {
        return createJsonResponse(200, {
          user: { id: 'user-1', username: 'alpha', email: 'alpha@example.com' },
          session: { authenticated: true },
        })
      }

      if (url.includes('/auth/logout') && method === 'POST') {
        return createJsonResponse(200, {
          ok: true,
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderShell(['/dashboard'])

    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByText('Sign in route')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/logout'), expect.objectContaining({ method: 'POST' }))
  })
})
