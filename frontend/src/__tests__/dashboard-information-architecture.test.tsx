// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
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

function renderDashboardPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/events" element={<p>Events page</p>} />
          <Route path="/items/:itemId" element={<p>Item detail page</p>} />
          <Route path="/items/create/wizard" element={<p>Create item page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

type DashboardEventGroup = {
  due_date: string
  events: Array<Record<string, unknown>>
}

const DEFAULT_PENDING_GROUPS: DashboardEventGroup[] = [
  {
    due_date: '2026-03-14',
    events: [
      {
        id: 'event-1',
        item_id: 'item-1',
        type: 'Mortgage',
        amount: 1450,
        due_date: '2026-03-14',
        status: 'Pending',
        updated_at: '2026-03-10T00:00:00.000Z',
      },
    ],
  },
  {
    due_date: '2026-03-09',
    events: [
      {
        id: 'event-2',
        item_id: 'item-2',
        type: 'Insurance',
        amount: 220,
        due_date: '2026-03-09',
        status: 'Pending',
        updated_at: '2026-03-08T00:00:00.000Z',
      },
    ],
  },
]

const DEFAULT_COMPLETED_GROUPS: DashboardEventGroup[] = [
  {
    due_date: '2026-03-08',
    events: [
      {
        id: 'event-3',
        item_id: 'item-1',
        type: 'Mortgage',
        amount: 1450,
        due_date: '2026-03-08',
        status: 'Completed',
        updated_at: '2026-03-10T00:00:00.000Z',
        completed_at: '2026-03-10T00:00:00.000Z',
      },
      {
        id: 'event-4',
        item_id: 'item-2',
        type: 'Insurance',
        amount: 220,
        due_date: '2026-03-07',
        status: 'Completed',
        updated_at: '2026-03-09T00:00:00.000Z',
        completed_at: '2026-03-09T00:00:00.000Z',
        is_manual_override: true,
      },
    ],
  },
]

function countEvents(groups: DashboardEventGroup[]) {
  return groups.reduce((total, group) => total + group.events.length, 0)
}

function createDashboardFetchMock(options: {
  pendingGroups?: DashboardEventGroup[]
  completedGroups?: DashboardEventGroup[]
} = {}) {
  const pendingGroups = options.pendingGroups ?? DEFAULT_PENDING_GROUPS
  const completedGroups = options.completedGroups ?? DEFAULT_COMPLETED_GROUPS

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'

    if (url.pathname === '/events' && url.searchParams.get('status') === 'pending' && method === 'GET') {
      return createResponse({
        status: 200,
        json: {
          groups: pendingGroups,
          total_count: countEvents(pendingGroups),
        },
      })
    }

    if (url.pathname === '/events' && url.searchParams.get('status') === 'completed' && method === 'GET') {
      return createResponse({
        status: 200,
        json: {
          groups: completedGroups,
          total_count: countEvents(completedGroups),
        },
      })
    }

    if (url.pathname === '/items' && url.searchParams.get('filter') === 'assets' && method === 'GET') {
      return createResponse({
        status: 200,
        json: {
          items: [
            {
              id: 'asset-1',
              item_type: 'Property',
              attributes: { name: 'Primary Home' },
              updated_at: '2026-03-10T00:00:00.000Z',
            },
            {
              id: 'asset-2',
              item_type: 'Vehicle',
              attributes: { name: 'Family SUV' },
              updated_at: '2026-03-09T00:00:00.000Z',
            },
          ],
          total_count: 2,
        },
      })
    }

    if (url.pathname === '/items' && url.searchParams.get('filter') === 'all' && method === 'GET') {
      return createResponse({
        status: 200,
        json: {
          items: [
            {
              id: 'item-1',
              item_type: 'FinancialItem',
              type: 'Commitment',
              linked_asset_item_id: 'asset-1',
              attributes: { name: 'Maple Mortgage', financialSubtype: 'Commitment', linkedAssetItemId: 'asset-1' },
              updated_at: '2026-03-10T00:00:00.000Z',
            },
            {
              id: 'item-2',
              item_type: 'FinancialItem',
              type: 'Commitment',
              linked_asset_item_id: 'asset-2',
              attributes: { name: 'Home Insurance', financialSubtype: 'Commitment', linkedAssetItemId: 'asset-2' },
              updated_at: '2026-03-09T00:00:00.000Z',
            },
            {
              id: 'item-3',
              item_type: 'FinancialItem',
              type: 'Income',
              attributes: { name: 'Tenant Rent', financialSubtype: 'Income' },
              updated_at: '2026-03-08T00:00:00.000Z',
            },
            {
              id: 'asset-1',
              item_type: 'Property',
              attributes: { name: 'Primary Home' },
              updated_at: '2026-03-07T00:00:00.000Z',
            },
          ],
          total_count: 4,
        },
      })
    }

    if (url.pathname === '/items/asset-1/net-status' && method === 'GET') {
      return createResponse({
        status: 200,
        json: {
          id: 'asset-1',
          summary: {
            net_monthly_cashflow: 980,
            active_period: {
              cadence: 'monthly',
              start_date: '2026-03-01',
              end_date: '2026-03-31',
              label: 'Mar 1 - Mar 31',
            },
            cadence_totals: {
              total: {
                net_cashflow: {
                  monthly: 980,
                },
                active_periods: {
                  monthly: {
                    start_date: '2026-03-01',
                    end_date: '2026-03-31',
                    label: 'Mar 1 - Mar 31',
                  },
                },
              },
            },
          },
        },
      })
    }

    if (url.pathname === '/items/asset-2/net-status' && method === 'GET') {
      return createResponse({
        status: 200,
        json: {
          id: 'asset-2',
          summary: {
            net_monthly_cashflow: -180,
            active_period: {
              cadence: 'monthly',
              start_date: '2026-03-01',
              end_date: '2026-03-31',
              label: 'Mar 1 - Mar 31',
            },
            cadence_totals: {
              total: {
                net_cashflow: {
                  monthly: -180,
                },
                active_periods: {
                  monthly: {
                    start_date: '2026-03-01',
                    end_date: '2026-03-31',
                    label: 'Mar 1 - Mar 31',
                  },
                },
              },
            },
          },
        },
      })
    }

    throw new Error(`Unhandled request: ${method} ${url.pathname}${url.search}`)
  })
}

describe('dashboard information architecture', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders four period-aware summary cards in the locked priority order', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-11T12:00:00.000Z').getTime())
    globalThis.fetch = createDashboardFetchMock() as typeof fetch

    renderDashboardPage()

    await screen.findByText('Net cashflow')

    const metricLabels = Array.from(document.querySelectorAll('[data-dashboard-metric-card="true"] p'))
      .map((node) => node.textContent?.trim())
      .filter(Boolean)

    expect(metricLabels.slice(0, 4)).toEqual(['Net cashflow', 'Upcoming due', 'Overdue', 'Completed activity'])

    const cards = screen.getAllByRole('article').filter((node) => node.getAttribute('data-dashboard-metric-card') === 'true')
    expect(cards).toHaveLength(4)

    expect(within(cards[0]).getByText('-$3,340')).toBeTruthy()
    expect(within(cards[0]).getByText('Based on events due in Mar 1 - Mar 31.')).toBeTruthy()

    expect(within(cards[1]).getByText('$1,450')).toBeTruthy()
    expect(within(cards[1]).getByText('1 upcoming rows due in Mar 1 - Mar 31.')).toBeTruthy()

    expect(within(cards[2]).getByText('1')).toBeTruthy()
    expect(within(cards[2]).getByText('1 row overdue in Mar 1 - Mar 31.')).toBeTruthy()

    expect(within(cards[3]).getByText('2')).toBeTruthy()
    expect(within(cards[3]).getByText('2 completed in Mar 1 - Mar 31, including 1 manual overrides.')).toBeTruthy()
  })

  it('keeps dashboard summary math month-bounded across net, upcoming, overdue, and completed cards', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-11T12:00:00.000Z').getTime())
    globalThis.fetch = createDashboardFetchMock({
      pendingGroups: [
        {
          due_date: '2026-03-05',
          events: [
            {
              id: 'pending-overdue-march',
              item_id: 'item-1',
              type: 'Mortgage',
              amount: 100,
              due_date: '2026-03-05',
              status: 'Pending',
              updated_at: '2026-03-09T00:00:00.000Z',
            },
          ],
        },
        {
          due_date: '2026-03-20',
          events: [
            {
              id: 'pending-upcoming-march',
              item_id: 'item-2',
              type: 'Insurance',
              amount: 300,
              due_date: '2026-03-20',
              status: 'Pending',
              updated_at: '2026-03-10T00:00:00.000Z',
            },
          ],
        },
        {
          due_date: '2026-04-02',
          events: [
            {
              id: 'pending-next-month',
              item_id: 'item-1',
              type: 'Mortgage',
              amount: 999,
              due_date: '2026-04-02',
              status: 'Pending',
              updated_at: '2026-03-10T00:00:00.000Z',
            },
          ],
        },
      ],
      completedGroups: [
        {
          due_date: '2026-03-10',
          events: [
            {
              id: 'completed-income-march',
              item_id: 'item-3',
              type: 'Income',
              amount: 2000,
              due_date: '2026-03-10',
              status: 'Completed',
              updated_at: '2026-03-10T00:00:00.000Z',
              completed_at: '2026-03-10T00:00:00.000Z',
            },
            {
              id: 'completed-commitment-march',
              item_id: 'item-2',
              type: 'Insurance',
              amount: 400,
              due_date: '2026-03-03',
              status: 'Completed',
              updated_at: '2026-03-03T00:00:00.000Z',
              completed_at: '2026-03-03T00:00:00.000Z',
              is_manual_override: true,
            },
          ],
        },
        {
          due_date: '2026-02-28',
          events: [
            {
              id: 'completed-last-month',
              item_id: 'item-1',
              type: 'Mortgage',
              amount: 900,
              due_date: '2026-02-28',
              status: 'Completed',
              updated_at: '2026-02-28T00:00:00.000Z',
              completed_at: '2026-02-28T00:00:00.000Z',
            },
          ],
        },
      ],
    }) as typeof fetch

    renderDashboardPage()

    await screen.findByText('Net cashflow')

    const cards = screen.getAllByRole('article').filter((node) => node.getAttribute('data-dashboard-metric-card') === 'true')
    expect(cards).toHaveLength(4)

    expect(within(cards[0]).getByText('$1,200')).toBeTruthy()
    expect(within(cards[1]).getByText('$300')).toBeTruthy()
    expect(within(cards[2]).getByText('1')).toBeTruthy()
    expect(within(cards[3]).getByText('2')).toBeTruthy()
    expect(within(cards[3]).getByText('2 completed in Mar 1 - Mar 31, including 1 manual overrides.')).toBeTruthy()
  })

  it('keeps monthly net cashflow stable when a row moves from pending to completed', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-11T12:00:00.000Z').getTime())

    globalThis.fetch = createDashboardFetchMock({
      pendingGroups: [
        {
          due_date: '2026-03-15',
          events: [
            {
              id: 'income-transition-row',
              item_id: 'item-3',
              type: 'Income',
              amount: 500,
              due_date: '2026-03-15',
              status: 'Pending',
              updated_at: '2026-03-10T00:00:00.000Z',
            },
          ],
        },
      ],
      completedGroups: [],
    }) as typeof fetch

    renderDashboardPage()
    await screen.findByText('Net cashflow')

    let cards = screen.getAllByRole('article').filter((node) => node.getAttribute('data-dashboard-metric-card') === 'true')
    expect(within(cards[0]).getByText('$500')).toBeTruthy()

    cleanup()

    globalThis.fetch = createDashboardFetchMock({
      pendingGroups: [],
      completedGroups: [
        {
          due_date: '2026-03-15',
          events: [
            {
              id: 'income-transition-row',
              item_id: 'item-3',
              type: 'Income',
              amount: 500,
              due_date: '2026-03-15',
              status: 'Completed',
              updated_at: '2026-03-15T00:00:00.000Z',
              completed_at: '2026-03-15T00:00:00.000Z',
            },
          ],
        },
      ],
    }) as typeof fetch

    renderDashboardPage()
    await screen.findByText('Net cashflow')

    cards = screen.getAllByRole('article').filter((node) => node.getAttribute('data-dashboard-metric-card') === 'true')
    expect(within(cards[0]).getByText('$500')).toBeTruthy()
  })

  it('ignores completed rows with due dates outside the active month for summary math', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-11T12:00:00.000Z').getTime())

    globalThis.fetch = createDashboardFetchMock({
      pendingGroups: [
        {
          due_date: '2026-03-18',
          events: [
            {
              id: 'march-pending-obligation',
              item_id: 'item-1',
              type: 'Mortgage',
              amount: 100,
              due_date: '2026-03-18',
              status: 'Pending',
              updated_at: '2026-03-10T00:00:00.000Z',
            },
          ],
        },
      ],
      completedGroups: [
        {
          due_date: '2026-04-05',
          events: [
            {
              id: 'april-income-completed-in-march',
              item_id: 'item-3',
              type: 'Income',
              amount: 1000,
              due_date: '2026-04-05',
              status: 'Completed',
              updated_at: '2026-03-11T00:00:00.000Z',
              completed_at: '2026-03-11T00:00:00.000Z',
            },
          ],
        },
      ],
    }) as typeof fetch

    renderDashboardPage()
    await screen.findByText('Net cashflow')

    const cards = screen.getAllByRole('article').filter((node) => node.getAttribute('data-dashboard-metric-card') === 'true')
    expect(cards).toHaveLength(4)

    expect(within(cards[0]).getByText('-$100')).toBeTruthy()
    expect(within(cards[1]).getByText('$100')).toBeTruthy()
    expect(within(cards[2]).getByText('0')).toBeTruthy()
    expect(within(cards[3]).getByText('0')).toBeTruthy()
  })

  it('keeps needs attention dominant while moving portfolio and exception notices into the right rail', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-11T12:00:00.000Z').getTime())
    globalThis.fetch = createDashboardFetchMock() as typeof fetch

    renderDashboardPage()

    await screen.findByRole('heading', { name: 'Needs Attention' })

    const needsAttention = screen.getByRole('heading', { name: 'Needs Attention' })
    const portfolio = screen.getByRole('heading', { name: 'Portfolio snapshot' })
    const exceptions = screen.getByRole('heading', { name: 'Exceptions and notices' })
    const recentActivity = screen.getByRole('heading', { name: 'Recent Activity' })

    const primaryColumn = needsAttention.closest('[data-dashboard-body-column="primary"]')
    const secondaryColumn = portfolio.closest('[data-dashboard-body-column="secondary"]')

    expect(primaryColumn).toBeTruthy()
    expect(secondaryColumn).toBeTruthy()
    expect(exceptions.closest('[data-dashboard-body-column="secondary"]')).toBe(secondaryColumn)
    expect(primaryColumn).not.toBe(secondaryColumn)

    expect(within(secondaryColumn as HTMLElement).getByRole('heading', { name: 'Portfolio snapshot' })).toBeTruthy()
    expect(within(secondaryColumn as HTMLElement).getByRole('heading', { name: 'Exceptions and notices' })).toBeTruthy()

    expect(needsAttention.compareDocumentPosition(portfolio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(portfolio.compareDocumentPosition(exceptions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(exceptions.compareDocumentPosition(recentActivity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const overdueSection = screen.getByTestId('dashboard-action-queue-overdue')
    const upcomingSection = screen.getByTestId('dashboard-action-queue-upcoming')
    const overdueRows = within(overdueSection).getAllByTestId('dashboard-action-queue-row')
    const upcomingRows = within(upcomingSection).getAllByTestId('dashboard-action-queue-row')

    expect(overdueRows).toHaveLength(1)
    expect(within(overdueRows[0]).getAllByText('Insurance').length).toBeGreaterThan(0)
    expect(within(overdueRows[0]).getByText('1-7d')).toBeTruthy()

    expect(upcomingRows).toHaveLength(1)
    expect(within(upcomingRows[0]).getAllByText('Mortgage').length).toBeGreaterThan(0)
    expect(within(upcomingRows[0]).getByText('Maple Mortgage')).toBeTruthy()

    const exceptionPanel = screen.getByTestId('dashboard-exception-notices')
    expect(within(exceptionPanel).getByText('Manual overrides in period')).toBeTruthy()
    expect(within(exceptionPanel).getByText('1 completed row landed through a manual override in Mar 1 - Mar 31.')).toBeTruthy()

    const suvCard = screen.getByTestId('dashboard-asset-card-asset-2')
    expect(suvCard.getAttribute('data-dashboard-asset-alert')).toBe('overdue')
    expect(within(suvCard).getByText('Needs Attention')).toBeTruthy()
    expect(within(suvCard).getByText('1 overdue linked row')).toBeTruthy()

    const recentRows = screen.getAllByRole('listitem').filter((node) => node.getAttribute('data-recent-activity-row-id'))
    expect(recentRows).toHaveLength(2)
    expect(within(recentRows[0]).getByText('Completed')).toBeTruthy()
    expect(within(recentRows[1]).getByText('Manual override')).toBeTruthy()
    expect(within(recentRows[1]).getByText('Paid on Mar 9, 2026')).toBeTruthy()

    expect(screen.getAllByRole('link', { name: /Open events/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Maple Mortgage' }).length).toBeGreaterThan(0)
  })

  it('renders recent activity as a compact audit log with supporting period trend context and exact summary microcopy', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-11T12:00:00.000Z').getTime())
    globalThis.fetch = createDashboardFetchMock() as typeof fetch

    renderDashboardPage()

    await screen.findByRole('heading', { name: 'Recent Activity' })

    const trendStrip = screen.getByTestId('dashboard-activity-trend-strip')
    expect(within(trendStrip).getByText('Period activity trend')).toBeTruthy()
    expect(within(trendStrip).getByText('1 overdue row still open')).toBeTruthy()
    expect(within(trendStrip).getByText('1 upcoming row left this period')).toBeTruthy()
    expect(within(trendStrip).getByText('2 completed rows closed in Mar 1 - Mar 31')).toBeTruthy()

    const recentActivityList = screen.getByTestId('dashboard-recent-activity-list')
    expect(recentActivityList.getAttribute('data-recent-activity-density')).toBe('compact')
    expect(recentActivityList.getAttribute('data-recent-activity-style')).toBe('audit-log')

    const auditRows = within(recentActivityList)
      .getAllByRole('listitem')
      .filter((node) => node.getAttribute('data-recent-activity-row-id'))

    expect(auditRows).toHaveLength(2)
    expect(auditRows[0].getAttribute('data-recent-activity-variant')).toBe('audit-log-row')
    expect(within(auditRows[0]).getByText('Mortgage')).toBeTruthy()
    expect(within(auditRows[0]).getByText('Paid on Mar 10, 2026')).toBeTruthy()
    expect(within(auditRows[1]).getByText('Manual override')).toBeTruthy()

    const cards = screen.getAllByRole('article').filter((node) => node.getAttribute('data-dashboard-metric-card') === 'true')
    expect(within(cards[0]).getByText('Based on events due in Mar 1 - Mar 31.')).toBeTruthy()
    expect(within(cards[1]).getByText('1 upcoming rows due in Mar 1 - Mar 31.')).toBeTruthy()
    expect(within(cards[2]).getByText('1 row overdue in Mar 1 - Mar 31.')).toBeTruthy()
    expect(within(cards[3]).getByText('2 completed in Mar 1 - Mar 31, including 1 manual overrides.')).toBeTruthy()

    expect(screen.queryByText('Based on March activity.')).toBeNull()
    expect(screen.queryByText('1 upcoming due this month.')).toBeNull()
  })

  it('keeps action queue split into overdue and upcoming sections with the 14-day upcoming window', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-11T12:00:00.000Z').getTime())
    globalThis.fetch = createDashboardFetchMock({
      pendingGroups: [
        {
          due_date: '2026-03-09',
          events: [
            {
              id: 'event-overdue',
              item_id: 'item-2',
              type: 'Insurance',
              amount: 220,
              due_date: '2026-03-09',
              status: 'Pending',
              updated_at: '2026-03-08T00:00:00.000Z',
            },
            {
              id: 'event-upcoming-window',
              item_id: 'item-1',
              type: 'Mortgage',
              amount: 1450,
              due_date: '2026-03-20',
              status: 'Pending',
              updated_at: '2026-03-10T00:00:00.000Z',
            },
            {
              id: 'event-upcoming-outside-window',
              item_id: 'item-1',
              type: 'Mortgage',
              amount: 1450,
              due_date: '2026-03-31',
              status: 'Pending',
              updated_at: '2026-03-10T00:00:00.000Z',
            },
          ],
        },
      ],
    }) as typeof fetch

    renderDashboardPage()

    const overdueSection = await screen.findByTestId('dashboard-action-queue-overdue')
    const overdueRows = within(overdueSection).getAllByTestId('dashboard-action-queue-row')
    expect(overdueRows).toHaveLength(1)
    expect(within(overdueRows[0]).getAllByText('Insurance').length).toBeGreaterThan(0)

    const upcomingSection = screen.getByTestId('dashboard-action-queue-upcoming')
    const upcomingRows = within(upcomingSection).getAllByTestId('dashboard-action-queue-row')
    expect(upcomingRows).toHaveLength(1)
    expect(within(upcomingRows[0]).getAllByText('Mortgage').length).toBeGreaterThan(0)
    expect(within(upcomingSection).queryByText('Mar 31, 2026')).toBeNull()
  })

  it('renders full overdue queue without truncation and keeps recent activity section visible', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-11T12:00:00.000Z').getTime())
    globalThis.fetch = createDashboardFetchMock({
      pendingGroups: [
        {
          due_date: '2026-03-08',
          events: Array.from({ length: 9 }, (_, index) => ({
            id: `event-overflow-${index + 1}`,
            item_id: index % 2 === 0 ? 'item-1' : 'item-2',
            type: index % 2 === 0 ? 'Mortgage' : 'Insurance',
            amount: index % 2 === 0 ? 1450 : 220,
            due_date: `2026-03-${String(index + 1).padStart(2, '0')}`,
            status: 'Pending',
            updated_at: '2026-03-10T00:00:00.000Z',
          })),
        },
      ],
    }) as typeof fetch

    renderDashboardPage()

    const overdueSection = await screen.findByTestId('dashboard-action-queue-overdue')
    const attentionRows = within(overdueSection).getAllByTestId('dashboard-action-queue-row')
    expect(attentionRows).toHaveLength(9)
    expect(screen.queryByText('Showing first 6 of 9 rows.')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeTruthy()
  })

  it('locks the summary band to a stacked mobile order instead of a cramped small-screen grid', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-11T12:00:00.000Z').getTime())
    globalThis.fetch = createDashboardFetchMock() as typeof fetch

    renderDashboardPage()

    await screen.findByText('Net cashflow')

    const summaryBand = document.querySelector('[data-dashboard-summary-band="true"]') as HTMLElement | null
    expect(summaryBand).toBeTruthy()
    expect(summaryBand?.querySelector('.grid')?.className).toContain('grid-cols-1')
    expect(summaryBand?.querySelector('.grid')?.className).not.toContain('sm:grid-cols-2')

    const metricLabels = Array.from(document.querySelectorAll('[data-dashboard-metric-card="true"] p'))
      .map((node) => node.textContent?.trim())
      .filter(Boolean)

    expect(metricLabels.slice(0, 4)).toEqual(['Net cashflow', 'Upcoming due', 'Overdue', 'Completed activity'])
  })
})
