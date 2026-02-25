// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { UserSwitcher } from '../app/shell/user-switcher'
import { apiRequest, setActiveActorUserId } from '../lib/api-client'
import { actorSensitiveQueryRoots } from '../lib/query-keys'

function createResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function getHeaderValue(headers: HeadersInit | undefined, name: string) {
  if (!headers) {
    return null
  }

  const target = name.toLowerCase()

  if (headers instanceof Headers) {
    return headers.get(name)
  }

  if (Array.isArray(headers)) {
    const pair = headers.find(([key]) => key.toLowerCase() === target)
    return pair?.[1] ?? null
  }

  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === target)
  const value = match?.[1]
  return typeof value === 'string' ? value : null
}

describe('user switcher actor-sensitive cache refresh', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    setActiveActorUserId(null)
    window.localStorage.removeItem('hact.active-user-id')
    vi.restoreAllMocks()
  })

  it('purges and refetches dashboard/events/items queries for the newly selected actor', async () => {
    const dashboardActors: Array<string | null> = []

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const actor = getHeaderValue(init?.headers, 'x-user-id')

      if (url.includes('/users') && method === 'GET') {
        return createResponse(200, {
          users: [
            { id: 'user-1', username: 'Alpha', email: 'alpha@example.com' },
            { id: 'user-2', username: 'Beta', email: 'beta@example.com' },
          ],
          total_count: 2,
        })
      }

      if (url.includes('/dashboard') && method === 'GET') {
        dashboardActors.push(actor)
        return createResponse(200, { actor })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch
    setActiveActorUserId('user-1')
    window.localStorage.setItem('hact.active-user-id', 'user-1')

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    })

    const removeSpy = vi.spyOn(queryClient, 'removeQueries')
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries')

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UserSwitcher />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByDisplayValue('Alpha')

    await userEvent.selectOptions(screen.getByRole('combobox'), 'user-2')

    await waitFor(() => {
      expect(screen.getByDisplayValue('Beta')).toBeTruthy()
    })

    for (const queryKey of actorSensitiveQueryRoots) {
      expect(removeSpy).toHaveBeenCalledWith({ queryKey })
      expect(refetchSpy).toHaveBeenCalledWith({ queryKey, type: 'active' })
    }

    await apiRequest('/dashboard')

    expect(dashboardActors).toContain('user-2')
  })
})
