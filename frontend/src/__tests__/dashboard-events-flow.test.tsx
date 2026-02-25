// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { EventsPage } from '../pages/events/events-page'

type FetchMockResponse = {
  status: number
  json: unknown
}

function createResponse(payload: FetchMockResponse) {
  return new Response(JSON.stringify(payload.json), {
    status: payload.status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function buildEventsResponse() {
  return {
    groups: [
      {
        due_date: '2026-02-26',
        events: [
          {
            id: 'event-1',
            item_id: 'item-1',
            type: 'Mortgage',
            amount: 1400,
            due_date: '2026-02-26',
            status: 'Pending',
            updated_at: '2026-02-25T00:00:00.000Z',
          },
        ],
      },
    ],
    total_count: 1,
  }
}

function renderEventsPage() {
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

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('dashboard/events completion flow', () => {
  const originalFetch = globalThis.fetch
  const originalConfirm = window.confirm

  beforeEach(() => {
    window.confirm = vi.fn(() => true)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    window.confirm = originalConfirm
    vi.restoreAllMocks()
  })

  it('opens follow-up modal only when completion payload requests prompt_next_date', async () => {
    let listCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=pending') && method === 'GET') {
        listCalls += 1
        return createResponse({ status: 200, json: buildEventsResponse() })
      }

      if (url.includes('/events/event-1/complete') && method === 'PATCH') {
        return createResponse({
          status: 200,
          json: {
            id: 'event-1',
            prompt_next_date: true,
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    await screen.findByText('Mortgage')
    await userEvent.click(screen.getByRole('button', { name: 'Complete' }))

    expect(await screen.findByText('Schedule the next date')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy()

    await waitFor(() => {
      expect(listCalls).toBeGreaterThan(1)
    })
  })

  it('keeps follow-up modal closed when completion payload has prompt_next_date false', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=pending') && method === 'GET') {
        return createResponse({ status: 200, json: buildEventsResponse() })
      }

      if (url.includes('/events/event-1/complete') && method === 'PATCH') {
        return createResponse({
          status: 200,
          json: {
            id: 'event-1',
            prompt_next_date: false,
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    await screen.findByText('Mortgage')
    await userEvent.click(screen.getByRole('button', { name: 'Complete' }))

    await waitFor(() => {
      expect(screen.queryByText('Schedule the next date')).toBeNull()
    })
  })
})
