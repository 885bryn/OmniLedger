// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { EventsPage } from '../pages/events/events-page'
import { DashboardPage } from '../pages/dashboard/dashboard-page'

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    session: {
      id: 'actor-1',
      username: 'tester',
      email: 'tester@example.com',
      role: 'admin',
    },
  }),
}))

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

function buildEventsResponse(currentEvent: { id: string; status: string }) {
  return {
    groups: [
      {
        due_date: '2026-02-26',
        events: [
          {
            id: currentEvent.id,
            item_id: 'item-1',
            type: 'Mortgage',
            amount: 1400,
            due_date: '2026-02-26',
            status: currentEvent.status,
            updated_at: '2026-02-25T00:00:00.000Z',
            source_state: 'persisted',
            is_projected: false,
          },
        ],
      },
      {
        due_date: '2026-02-10',
        events: [
          {
            id: 'event-2',
            item_id: 'item-2',
            type: 'Insurance',
            amount: 220,
            due_date: '2026-02-10',
            status: 'Completed',
            updated_at: '2026-02-11T00:00:00.000Z',
            source_state: 'persisted',
            is_projected: false,
          },
        ],
      },
    ],
    total_count: 2,
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
      <MemoryRouter initialEntries={['/events']}>
        <Routes>
          <Route path="/events" element={<EventsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderDashboardPage() {
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
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/items/:itemId" element={<p>Item detail page</p>} />
          <Route path="/items/create/wizard" element={<p>Create item page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('dashboard/events completion flow', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('completes event without showing recurring schedule follow-up modal', async () => {
    let listCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        listCalls += 1
        return createResponse({
          status: 200,
          json:
            listCalls === 1
              ? buildEventsResponse({ id: 'event-1', status: 'Pending' })
              : buildEventsResponse({ id: 'event-1', status: 'Completed' }),
        })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
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
                status: 'Closed',
                attributes: { name: 'Home Insurance' },
              },
            ],
          },
        })
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
    const eventsHeader = document.querySelector('[data-events-header="true"]') as HTMLElement | null
    expect(eventsHeader).toBeTruthy()
    expect(eventsHeader?.className.includes('animate-fade-up')).toBe(false)
    expect(screen.getByText('Mortgage').closest('[data-event-row-id="event-1"]')).toBeTruthy()
    expect(document.querySelector('[data-event-group="overdue"]')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Upcoming' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'History' })).toBeTruthy()
    expect(screen.getByText(/Monthly, (next on|no upcoming date)/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Mark Paid' }))

    await waitFor(() => {
      expect(screen.queryByText('Schedule the next date')).toBeNull()
    })

    expect(await screen.findByText('Nothing pressing right now.')).toBeTruthy()

    await new Promise((resolve) => window.setTimeout(resolve, 850))

    await userEvent.click(screen.getByRole('tab', { name: 'History' }))
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(listCalls).toBeGreaterThan(1)
    })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Mark Paid' })).toBeNull()
    })
  })

  it('keeps completion flow unchanged when prompt_next_date is false', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return createResponse({ status: 200, json: buildEventsResponse({ id: 'event-1', status: 'Pending' }) })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
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
                status: 'Closed',
                attributes: { name: 'Home Insurance' },
              },
            ],
          },
        })
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
    await userEvent.click(screen.getByRole('button', { name: 'Mark Paid' }))

    await waitFor(() => {
      expect(screen.queryByText('Schedule the next date')).toBeNull()
    })
  })

  it('keeps completed history rows read-only without an inline undo action', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return createResponse({ status: 200, json: buildEventsResponse({ id: 'event-1', status: 'Pending' }) })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
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
                status: 'Closed',
                attributes: { name: 'Home Insurance' },
              },
            ],
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    await screen.findByText('Mortgage')
    await userEvent.click(screen.getByRole('tab', { name: 'History' }))
    await screen.findByText('Insurance')

    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(screen.getByText('Paid on Feb 10, 2026')).toBeTruthy()
  })

  it('computes upcoming amount from outflows only, excluding income events', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-10T12:00:00.000Z').getTime())

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const parsedUrl = new URL(url, 'http://localhost')
      const pathname = parsedUrl.pathname
      const search = parsedUrl.searchParams

      if (pathname === '/events' && search.get('status') === 'pending' && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            groups: [
              {
                due_date: '2026-03-10',
                events: [
                  {
                    id: 'event-1',
                    item_id: 'item-commitment',
                    type: 'Mortgage',
                    amount: 1400,
                    due_date: '2026-03-10',
                    status: 'Pending',
                    updated_at: '2026-02-25T00:00:00.000Z',
                    source_state: 'persisted',
                    is_projected: false,
                  },
                  {
                    id: 'event-2',
                    item_id: 'item-income',
                    type: 'Renting out SUV',
                    amount: 2200,
                    due_date: '2026-03-12',
                    status: 'Pending',
                    updated_at: '2026-02-25T00:00:00.000Z',
                    source_state: 'persisted',
                    is_projected: false,
                  },
                ],
              },
            ],
            total_count: 2,
          },
        })
      }

      if (pathname === '/items' && search.get('filter') === 'assets' && method === 'GET') {
        return createResponse({ status: 200, json: { items: [], total_count: 0 } })
      }

      if (pathname === '/items' && search.get('filter') === 'all' && search.get('sort') === 'recently_updated' && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              {
                id: 'item-commitment',
                item_type: 'FinancialItem',
                type: 'Commitment',
                title: 'Maple Mortgage',
                frequency: 'monthly',
                status: 'Active',
                attributes: { name: 'Maple Mortgage', financialSubtype: 'Commitment' },
                updated_at: '2026-02-25T00:00:00.000Z',
              },
              {
                id: 'item-income',
                item_type: 'FinancialItem',
                type: 'Income',
                title: 'Renting out SUV',
                frequency: 'weekly',
                status: 'Active',
                attributes: { name: 'Renting out SUV', financialSubtype: 'Income' },
                updated_at: '2026-02-25T00:00:00.000Z',
              },
            ],
            total_count: 2,
          },
        })
      }

      return createResponse({ status: 200, json: { groups: [], total_count: 0, items: [] } })
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderDashboardPage()

    await screen.findByText('Upcoming due')
    const upcomingAmountCard = screen.getByText('Upcoming due').closest('[data-dashboard-metric-card="true"]') as HTMLElement | null
    expect(upcomingAmountCard).toBeTruthy()

    if (!upcomingAmountCard) {
      throw new Error('Expected upcoming amount card')
    }

    expect(within(upcomingAmountCard).getByText('$1,400')).toBeTruthy()
    expect(within(upcomingAmountCard).queryByText('$3,600')).toBeNull()
    expect(screen.getByText((content) => content.includes('+$2,200'))).toBeTruthy()
  })

  it('renders cents consistently in dashboard metrics and event rows for non-whole amounts', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-10T12:00:00.000Z').getTime())

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=pending') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            groups: [
              {
                due_date: '2026-03-10',
                events: [
                  {
                    id: 'event-1',
                    item_id: 'item-1',
                    type: 'Insurance',
                    amount: 707.4,
                    due_date: '2026-03-10',
                    status: 'Pending',
                    updated_at: '2026-03-10T00:00:00.000Z',
                    source_state: 'persisted',
                    is_projected: false,
                  },
                ],
              },
            ],
            total_count: 1,
          },
        })
      }

      if (url.includes('/items?filter=assets') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              {
                id: 'asset-1',
                item_type: 'Vehicle',
                attributes: { name: 'Family SUV' },
                updated_at: '2026-03-10T00:00:00.000Z',
              },
            ],
            total_count: 1,
          },
        })
      }

      if (url.includes('/items?filter=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              {
                id: 'item-1',
                item_type: 'FinancialItem',
                type: 'Commitment',
                title: 'Insurance',
                frequency: 'monthly',
                status: 'Active',
                attributes: { name: 'Insurance', financialSubtype: 'Commitment' },
                updated_at: '2026-03-10T00:00:00.000Z',
              },
            ],
            total_count: 1,
          },
        })
      }

      if (url.includes('/events?status=completed') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            groups: [],
            total_count: 0,
          },
        })
      }

      if (url.includes('/events?status=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            groups: [
              {
                due_date: '2026-03-10',
                events: [
                  {
                    id: 'event-1',
                    item_id: 'item-1',
                    type: 'Insurance',
                    amount: 707.4,
                    due_date: '2026-03-10',
                    status: 'Pending',
                    updated_at: '2026-03-10T00:00:00.000Z',
                    source_state: 'persisted',
                    is_projected: false,
                  },
                ],
              },
            ],
            total_count: 1,
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderDashboardPage()

    await screen.findByText('Upcoming due')
    expect(screen.getByText('$707.40')).toBeTruthy()

    cleanup()

    renderEventsPage()

    expect(await screen.findByText('$707.40')).toBeTruthy()
  })

  it('shows projected/persisted legend and keeps persisted rows above projected rows on same date', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            groups: [
              {
                due_date: '2026-02-26',
                events: [
                  {
                    id: 'projected-item-1-2026-02-26',
                    item_id: 'item-1',
                    type: 'Projected Mortgage',
                    amount: 1400,
                    due_date: '2026-02-26',
                    status: 'Pending',
                    updated_at: '2026-02-26T00:00:00.000Z',
                    source_state: 'projected',
                    is_projected: true,
                  },
                  {
                    id: 'event-1',
                    item_id: 'item-2',
                    type: 'Persisted Mortgage',
                    amount: 1200,
                    due_date: '2026-02-26',
                    status: 'Pending',
                    updated_at: '2026-02-25T00:00:00.000Z',
                    source_state: 'persisted',
                    is_projected: false,
                  },
                ],
              },
            ],
            total_count: 2,
          },
        })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              {
                id: 'item-1',
                item_type: 'FinancialItem',
                type: 'Commitment',
                title: 'Projected Mortgage',
                frequency: 'monthly',
                status: 'Active',
                attributes: { name: 'Projected Mortgage' },
              },
              {
                id: 'item-2',
                item_type: 'FinancialItem',
                type: 'Commitment',
                title: 'Persisted Mortgage',
                frequency: 'monthly',
                status: 'Active',
                attributes: { name: 'Persisted Mortgage' },
              },
            ],
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    await screen.findAllByText('Persisted Mortgage')
    expect(screen.getAllByText('Projected').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Persisted').length).toBeGreaterThan(0)

    const rows = Array.from(document.querySelectorAll('[data-event-row-id]'))
    expect(rows).toHaveLength(2)
    expect(within(rows[0] as HTMLElement).getByText('Persisted')).toBeTruthy()
    expect(within(rows[1] as HTMLElement).getByText('Projected')).toBeTruthy()
  })

  it('shows edited occurrence state on persisted exception rows', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            groups: [
              {
                due_date: '2026-03-03',
                events: [
                  {
                    id: 'event-1',
                    item_id: 'item-1',
                    type: 'Mortgage',
                    amount: 1500,
                    due_date: '2026-03-05',
                    status: 'Pending',
                    updated_at: '2026-03-03T00:00:00.000Z',
                    source_state: 'persisted',
                    is_projected: false,
                    is_exception: true,
                  },
                ],
              },
            ],
            total_count: 1,
          },
        })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
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
            ],
          },
        })
      }

      if (url.includes('/events?status=completed') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            groups: [],
            total_count: 0,
          },
        })
      }

      if (url.includes('/events?status=completed') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            groups: [],
            total_count: 0,
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    await screen.findByText('Mortgage')
    expect(screen.getByText('Edited occurrence')).toBeTruthy()
    expect(document.querySelector('[data-event-row-id="event-1"]')).toBeTruthy()
  })
})
