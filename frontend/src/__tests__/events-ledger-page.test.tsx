// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { EventsPage } from '../pages/events/events-page'

vi.mock('../features/admin-scope/admin-scope-context', () => ({
  useAdminScope: () => adminScopeState,
}))

let adminScopeState: {
  isAdmin: boolean
  mode: 'all' | 'owner'
  lensUserId: string | null
  users: Array<{ id: string; username: string; email: string }>
}

type MockPayload = {
  status: number
  json: unknown
}

function createResponse(payload: MockPayload) {
  return new Response(JSON.stringify(payload.json), {
    status: payload.status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderEventsPage() {
  const queryClient = createQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/events']}>
        <Routes>
          <Route path="/events" element={<EventsPage />} />
          <Route path="/items/:itemId" element={<div>item detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function buildItemsResponse() {
  return {
    items: [
      {
        id: 'item-1',
        item_type: 'FinancialItem',
        type: 'Commitment',
        title: 'Maple Mortgage',
        frequency: 'monthly',
        status: 'Active',
        attributes: { name: 'Maple Mortgage' },
      },
      {
        id: 'item-2',
        item_type: 'FinancialItem',
        type: 'Commitment',
        title: 'Home Insurance',
        frequency: 'yearly',
        status: 'Active',
        attributes: { name: 'Home Insurance' },
      },
      {
        id: 'item-3',
        item_type: 'FinancialItem',
        type: 'Income',
        title: 'Salary',
        frequency: 'monthly',
        status: 'Active',
        attributes: { name: 'Salary' },
      },
      {
        id: 'item-4',
        item_type: 'FinancialItem',
        type: 'Commitment',
        title: 'Property Tax',
        frequency: 'yearly',
        status: 'Active',
        attributes: { name: 'Property Tax' },
      },
      {
        id: 'item-5',
        item_type: 'FinancialItem',
        type: 'Commitment',
        title: 'Renovation Draw',
        frequency: 'one_time',
        status: 'Active',
        attributes: { name: 'Renovation Draw' },
      },
    ],
  }
}

function buildLedgerEventsResponse() {
  return {
    groups: [
      {
        due_date: '2026-03-05',
        events: [
          {
            id: 'event-overdue',
            item_id: 'item-2',
            type: 'Insurance premium',
            amount: 220,
            due_date: '2026-03-05',
            status: 'Pending',
            updated_at: '2026-03-01T00:00:00.000Z',
            source_state: 'persisted',
            is_projected: false,
          },
        ],
      },
      {
        due_date: '2026-03-10',
        events: [
          {
            id: 'event-today',
            item_id: 'item-1',
            type: 'Mortgage payment',
            amount: 1400,
            due_date: '2026-03-10',
            status: 'Pending',
            updated_at: '2026-03-02T00:00:00.000Z',
            source_state: 'persisted',
            is_projected: false,
          },
        ],
      },
      {
        due_date: '2026-03-16',
        events: [
          {
            id: 'event-week',
            item_id: 'item-3',
            type: 'Salary deposit',
            amount: 3200,
            due_date: '2026-03-16',
            status: 'Pending',
            updated_at: '2026-03-02T00:00:00.000Z',
            source_state: 'projected',
            is_projected: true,
          },
        ],
      },
      {
        due_date: '2026-03-22',
        events: [
          {
            id: 'event-month',
            item_id: 'item-4',
            type: 'Property tax installment',
            amount: 450,
            due_date: '2026-03-22',
            status: 'Pending',
            updated_at: '2026-03-03T00:00:00.000Z',
            source_state: 'persisted',
            is_projected: false,
          },
        ],
      },
      {
        due_date: '2026-04-02',
        events: [
          {
            id: 'event-future',
            item_id: 'item-5',
            type: 'Renovation draw',
            amount: 900,
            due_date: '2026-04-02',
            status: 'Pending',
            updated_at: '2026-03-04T00:00:00.000Z',
            source_state: 'projected',
            is_projected: true,
          },
        ],
      },
      {
        due_date: '2026-03-01',
        events: [
          {
            id: 'event-completed',
            item_id: 'item-1',
            type: 'Paid mortgage',
            amount: 1400,
            due_date: '2026-03-01',
            status: 'Completed',
            updated_at: '2026-03-01T00:00:00.000Z',
            source_state: 'persisted',
            is_projected: false,
          },
        ],
      },
    ],
    total_count: 6,
  }
}

describe('events ledger page', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    adminScopeState = {
      isAdmin: false,
      mode: 'owner',
      lensUserId: null,
      users: [],
    }

  })

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('defaults to Upcoming, supports switching to History, and keeps history intentionally empty', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return createResponse({ status: 200, json: buildLedgerEventsResponse() })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({ status: 200, json: buildItemsResponse() })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    const upcomingTab = await screen.findByRole('tab', { name: 'Upcoming' })
    const historyTab = screen.getByRole('tab', { name: 'History' })

    expect(upcomingTab.getAttribute('aria-selected')).toBe('true')
    expect(historyTab.getAttribute('aria-selected')).toBe('false')
    expect(await screen.findByText('Rolling 7-day window: today plus the next 6 calendar days.')).toBeTruthy()

    await userEvent.setup().click(historyTab)

    expect(historyTab.getAttribute('aria-selected')).toBe('true')
    expect(await screen.findByText('History is ready for the next phase.')).toBeTruthy()
    expect(screen.queryByText('Paid mortgage')).toBeNull()
  })

  it('groups upcoming rows into the four ledger buckets, hides empty groups, and removes row actions', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return createResponse({ status: 200, json: buildLedgerEventsResponse() })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({ status: 200, json: buildItemsResponse() })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const { container } = renderEventsPage()

    expect(await screen.findByText('Insurance premium')).toBeTruthy()

    const groups = Array.from(container.querySelectorAll('[data-event-group]')).map((node) => node.getAttribute('data-event-group'))
    expect(groups).toEqual(['overdue', 'thisWeek', 'laterThisMonth', 'future'])
    expect(container.querySelector('[data-sticky="true"]')).toBeTruthy()
    expect(container.querySelector('[data-overdue="true"]')).toBeTruthy()

    expect(screen.getByText('Mortgage payment')).toBeTruthy()
    expect(screen.getByText('Salary deposit')).toBeTruthy()
    expect(screen.getByText('Property tax installment')).toBeTruthy()
    expect(screen.getByText('Renovation draw')).toBeTruthy()
    expect(screen.getByText('Urgent')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('shows a calm loading skeleton before ledger data resolves', async () => {
    let resolveEvents: ((value: Response) => void) | null = null
    let resolveItems: ((value: Response) => void) | null = null

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return new Promise<Response>((resolve) => {
          resolveEvents = resolve
        })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return new Promise<Response>((resolve) => {
          resolveItems = resolve
        })
      }

      return Promise.reject(new Error(`Unhandled request: ${method} ${url}`))
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    expect(screen.getByLabelText('Loading events ledger')).toBeTruthy()

    ;(resolveEvents as ((value: Response) => void) | null)?.(createResponse({ status: 200, json: buildLedgerEventsResponse() }))
    ;(resolveItems as ((value: Response) => void) | null)?.(createResponse({ status: 200, json: buildItemsResponse() }))

    await waitFor(() => {
      expect(screen.getByText('Mortgage payment')).toBeTruthy()
    })
  })

  it('shows recovery copy and retries when the ledger request fails', async () => {
    let eventsAttempts = 0

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        eventsAttempts += 1
        if (eventsAttempts === 1) {
          throw new Error('network down')
        }

        return createResponse({ status: 200, json: buildLedgerEventsResponse() })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({ status: 200, json: buildItemsResponse() })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    expect(await screen.findByText("We couldn't refresh the events ledger.")).toBeTruthy()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry loading' }))

    await waitFor(() => {
      expect(screen.getByText('Mortgage payment')).toBeTruthy()
    })
    expect(eventsAttempts).toBe(2)
  })
})
