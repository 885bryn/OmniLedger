// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { EventsPage } from '../pages/events/events-page'

vi.mock('../features/admin-scope/admin-scope-context', () => ({
  useAdminScope: () => adminScopeState,
}))

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    session: {
      username: 'tester',
      email: 'tester@example.com',
    },
  }),
}))

vi.mock('../features/ui/toast-provider', () => ({
  useToast: () => ({
    pushSafetyToast: vi.fn(),
  }),
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

type EventRow = {
  id: string
  item_id: string
  type: string
  amount: number | null
  due_date: string
  status: string
  updated_at: string
  source_state: 'persisted' | 'projected'
  is_projected: boolean
  is_manual_override?: boolean
  completed_at?: string | null
}

type EventsMeta = {
  suppressed_invalid_projected_count?: number
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

function renderEventsPage(queryClient = createQueryClient()) {

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

function buildPendingRows(): EventRow[] {
  return [
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
  ]
}

function buildCompletedRows(): EventRow[] {
  return [
    {
      id: 'event-completed-march',
      item_id: 'item-1',
      type: 'Paid mortgage',
      amount: 1400,
      due_date: '2026-03-01',
      status: 'Completed',
      completed_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-01T08:00:00.000Z',
      source_state: 'persisted',
      is_projected: false,
    },
    {
      id: 'event-completed-feb',
      item_id: 'item-2',
      type: 'Insurance settled',
      amount: 220,
      due_date: '2026-02-20',
      status: 'Completed',
      completed_at: '2026-02-20T08:00:00.000Z',
      updated_at: '2026-02-20T08:00:00.000Z',
      source_state: 'persisted',
      is_projected: false,
    },
  ]
}

function buildManualOverrideRow(): EventRow {
  return {
    id: 'event-manual-override',
    item_id: 'item-5',
    type: 'Historical renovation draw',
    amount: 900,
    due_date: '2025-11-14',
    status: 'Completed',
    completed_at: '2025-11-14T08:00:00.000Z',
    updated_at: '2025-11-14T08:00:00.000Z',
    source_state: 'persisted',
    is_projected: false,
    is_manual_override: true,
  }
}

function buildLedgerEventsResponse(rows?: { pending?: EventRow[]; completed?: EventRow[]; meta?: EventsMeta }) {
  const pending = rows?.pending ?? buildPendingRows()
  const completed = rows?.completed ?? buildCompletedRows()
  const grouped = new Map<string, EventRow[]>()

  for (const event of [...pending, ...completed]) {
    const bucket = grouped.get(event.due_date) ?? []
    bucket.push(event)
    grouped.set(event.due_date, bucket)
  }

  return {
    groups: [...grouped.entries()].map(([due_date, events]) => ({ due_date, events })),
    total_count: pending.length + completed.length,
    ...(rows?.meta ? { meta: rows.meta } : {}),
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

  it('renders populated History grouped by reverse-chronological paid month', async () => {
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

    const user = userEvent.setup()
    await user.click(await screen.findByRole('tab', { name: 'History' }))

    const headings = await screen.findAllByRole('heading', { level: 2 })
    const labels = headings.map((heading) => heading.textContent)
    expect(labels).toContain('March 2026')
    expect(labels).toContain('February 2026')
    expect(labels.indexOf('March 2026')).toBeLessThan(labels.indexOf('February 2026'))

    expect(screen.getByText('Paid mortgage')).toBeTruthy()
    expect(screen.getByText('Paid on Mar 1, 2026')).toBeTruthy()
    expect(screen.getByText('Maple Mortgage')).toBeTruthy()
    expect(screen.getByText('$1,400')).toBeTruthy()
  })

  it('marks an upcoming row paid inline, disables duplicate taps while pending, and moves it into History without manual refresh', async () => {
    let eventsResponse = buildLedgerEventsResponse({ completed: [] })
    const completionCalls: string[] = []
    let resolveCompletion: (() => void) | null = null

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return Promise.resolve(createResponse({ status: 200, json: eventsResponse }))
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return Promise.resolve(createResponse({ status: 200, json: buildItemsResponse() }))
      }

      if (url.includes('/events/event-today/complete') && method === 'PATCH') {
        completionCalls.push(url)
        return new Promise((resolve: (value: Response) => void) => {
          resolveCompletion = () => {
            resolve(
              createResponse({
                status: 200,
                json: {
                  id: 'event-today',
                  item_id: 'item-1',
                  type: 'Mortgage payment',
                  due_date: '2026-03-10',
                  amount: 1400,
                  status: 'Completed',
                  completed_at: '2026-03-10T12:00:00.000Z',
                },
              }),
            )
          }
        })
      }

      return Promise.reject(new Error(`Unhandled request: ${method} ${url}`))
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    const user = userEvent.setup()
    const mortgageRow = (await screen.findByText('Mortgage payment')).closest('[data-event-row-id="event-today"]')
    expect(mortgageRow).toBeTruthy()
    const markPaidButton = within(mortgageRow as HTMLElement).getByRole('button', { name: 'Mark Paid' })

    expect(screen.queryByText('Confirm completion')).toBeNull()

    await user.click(markPaidButton)
    const pendingButton = await screen.findByRole('button', { name: 'Saving...' })
    expect(pendingButton.hasAttribute('disabled')).toBe(true)

    await user.click(pendingButton)
    expect(completionCalls).toHaveLength(1)

    await act(async () => {
      resolveCompletion?.()
    })

    expect(await screen.findByText('Paid today. Moving this row into History.')).toBeTruthy()

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 850))
    })

    await user.click(screen.getByRole('tab', { name: 'History' }))

    expect(await screen.findByText('Mortgage payment')).toBeTruthy()
    expect(screen.getByText('Saved successfully. History is catching up in the background.')).toBeTruthy()

    const movedRow = screen.getByText('Mortgage payment').closest('[data-history-highlighted]')
    expect(movedRow?.getAttribute('data-history-highlighted')).toBe('true')
  })

  it('keeps failures inline on the same row and allows retry', async () => {
    let completionAttempt = 0
    const completedOnRetry: EventRow = {
      id: 'event-today',
      item_id: 'item-1',
      type: 'Mortgage payment',
      amount: 1400,
      due_date: '2026-03-10',
      status: 'Completed',
      completed_at: '2026-03-10T12:00:00.000Z',
      updated_at: '2026-03-10T12:00:00.000Z',
      source_state: 'persisted',
      is_projected: false,
    }
    let eventsResponse = buildLedgerEventsResponse({ completed: [] })

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return createResponse({ status: 200, json: eventsResponse })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({ status: 200, json: buildItemsResponse() })
      }

      if (url.includes('/events/event-today/complete') && method === 'PATCH') {
        completionAttempt += 1

        if (completionAttempt === 1) {
          return createResponse({
            status: 422,
            json: {
              error: {
                code: 'event_complete_failed',
                message: 'Transition blocked',
              },
            },
          })
        }

        eventsResponse = buildLedgerEventsResponse({
          pending: buildPendingRows().filter((event) => event.id !== 'event-today'),
          completed: [completedOnRetry],
        })

        return createResponse({
          status: 200,
          json: {
            id: 'event-today',
            item_id: 'item-1',
            type: 'Mortgage payment',
            due_date: '2026-03-10',
            amount: 1400,
            status: 'Completed',
            completed_at: '2026-03-10T12:00:00.000Z',
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    const user = userEvent.setup()
    const mortgageRow = (await screen.findByText('Mortgage payment')).closest('[data-event-row-id="event-today"]')
    expect(mortgageRow).toBeTruthy()
    await user.click(within(mortgageRow as HTMLElement).getByRole('button', { name: 'Mark Paid' }))

    expect(await screen.findByText('Could not mark this row paid. Try again. (Transition blocked)')).toBeTruthy()
    expect(screen.getByText('Mortgage payment').closest('[data-event-row-id="event-today"]')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => {
      expect(screen.queryByText('Could not mark this row paid. Try again. (Transition blocked)')).toBeNull()
    })
    await user.click(screen.getByRole('tab', { name: 'History' }))
    expect(await screen.findByText('Mortgage payment')).toBeTruthy()
  })

  it('shows loading skeletons and recovers when the initial ledger request fails', async () => {
    let resolveEvents: ((value: Response) => void) | null = null
    let resolveItems: ((value: Response) => void) | null = null
    let failedOnce = false

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        if (!failedOnce) {
          return new Promise((resolve: (value: Response) => void) => {
            resolveEvents = resolve
          })
        }

        return Promise.resolve(createResponse({ status: 200, json: buildLedgerEventsResponse() }))
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return new Promise((resolve: (value: Response) => void) => {
          resolveItems = resolve
        })
      }

      return Promise.reject(new Error(`Unhandled request: ${method} ${url}`))
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    expect(screen.getByLabelText('Loading events ledger')).toBeTruthy()

    await act(async () => {
      resolveItems?.(createResponse({ status: 200, json: buildItemsResponse() }))
      failedOnce = true
      resolveEvents?.(createResponse({ status: 500, json: { error: { message: 'network down' } } }))
    })

    expect(await screen.findByText("We couldn't refresh the events ledger.")).toBeTruthy()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry loading' }))

    await waitFor(() => {
      expect(screen.getByText('Mortgage payment')).toBeTruthy()
    })
  })

  it('refetches on mount so a stale empty response does not leave the ledger blank after navigation', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData([
      'events',
      'list',
      { status: 'all', scope_mode: 'all' },
    ], buildLedgerEventsResponse({ pending: [], completed: [] }))

    let eventsRequestCount = 0

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        eventsRequestCount += 1

        return createResponse({ status: 200, json: buildLedgerEventsResponse() })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({ status: 200, json: buildItemsResponse() })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage(queryClient)

    expect(await screen.findByText('Mortgage payment')).toBeTruthy()
    expect(eventsRequestCount).toBeGreaterThanOrEqual(1)
  })

  it('renders an inline suppression notice only for admins when invalid projected rows were hidden', async () => {
    adminScopeState = {
      isAdmin: true,
      mode: 'all',
      lensUserId: null,
      users: [],
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: buildLedgerEventsResponse({
            meta: { suppressed_invalid_projected_count: 2 },
          }),
        })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({ status: 200, json: buildItemsResponse() })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    expect(await screen.findByText('2 invalid projected history rows were hidden from this ledger.')).toBeTruthy()
    expect(screen.getByText('These pre-origin projected rows were suppressed so the ledger stays clean while you review the underlying item data.')).toBeTruthy()
    expect(screen.getByText('2 hidden')).toBeTruthy()
  })

  it('keeps suppression messaging hidden for normal users even when the API payload includes admin metadata', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: buildLedgerEventsResponse({
            meta: { suppressed_invalid_projected_count: 3 },
          }),
        })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({ status: 200, json: buildItemsResponse() })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    await screen.findByText('Mortgage payment')

    expect(screen.queryByText('3 invalid projected history rows were hidden from this ledger.')).toBeNull()
    expect(screen.queryByText('These pre-origin projected rows were suppressed so the ledger stays clean while you review the underlying item data.')).toBeNull()
  })

  it('keeps manual override history rows visible with exceptional warning treatment', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/events?status=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: buildLedgerEventsResponse({
            completed: [buildCompletedRows()[0], buildCompletedRows()[1], buildManualOverrideRow()],
          }),
        })
      }

      if (url.includes('/items?filter=all&sort=recently_updated') && method === 'GET') {
        return createResponse({ status: 200, json: buildItemsResponse() })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEventsPage()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('tab', { name: 'History' }))

    expect(await screen.findByRole('heading', { name: 'November 2025' })).toBeTruthy()
    expect(screen.getByText('Historical renovation draw')).toBeTruthy()
    expect(screen.getByText('Manual override')).toBeTruthy()
    expect(screen.getByText('Logged as an exceptional manual history entry. Review the date and amount against the source record.')).toBeTruthy()

    const manualRow = screen.getByText('Historical renovation draw').closest('[data-manual-override]')
    expect(manualRow?.getAttribute('data-manual-override')).toBe('true')
    expect(within(manualRow as HTMLElement).getByText('Renovation Draw')).toBeTruthy()
    expect(within(manualRow as HTMLElement).getByText('$900')).toBeTruthy()
  })
})
