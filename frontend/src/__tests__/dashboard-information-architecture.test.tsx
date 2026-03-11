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

function createDashboardFetchMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'

    if (url.pathname === '/events' && url.searchParams.get('status') === 'pending' && method === 'GET') {
      return createResponse({
        status: 200,
        json: {
          groups: [
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
          ],
          total_count: 2,
        },
      })
    }

    if (url.pathname === '/events' && url.searchParams.get('status') === 'completed' && method === 'GET') {
      return createResponse({
        status: 200,
        json: {
          groups: [
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
          ],
          total_count: 2,
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
              attributes: { name: 'Maple Mortgage', financialSubtype: 'Commitment' },
              updated_at: '2026-03-10T00:00:00.000Z',
            },
            {
              id: 'item-2',
              item_type: 'FinancialItem',
              type: 'Commitment',
              attributes: { name: 'Home Insurance', financialSubtype: 'Commitment' },
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

    expect(within(cards[0]).getByText('$800')).toBeTruthy()
    expect(within(cards[0]).getByText('Across Mar 1 - Mar 31 from your asset summaries.')).toBeTruthy()

    expect(within(cards[1]).getByText('$1,450')).toBeTruthy()
    expect(within(cards[1]).getByText('1 upcoming rows across Mar 9 - Mar 14.')).toBeTruthy()

    expect(within(cards[2]).getByText('1')).toBeTruthy()
    expect(within(cards[2]).getByText('1 row needs attention right now.')).toBeTruthy()

    expect(within(cards[3]).getByText('2')).toBeTruthy()
    expect(within(cards[3]).getByText('2 recent completions, including 1 manual overrides.')).toBeTruthy()
  })

  it('renders overdue-first attention rows and a calmer recent activity feed with existing pathways', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-11T12:00:00.000Z').getTime())
    globalThis.fetch = createDashboardFetchMock() as typeof fetch

    renderDashboardPage()

    await screen.findByRole('heading', { name: 'Needs Attention' })

    const needsAttention = screen.getByRole('heading', { name: 'Needs Attention' })
    const recentActivity = screen.getByRole('heading', { name: 'Recent Activity' })
    const portfolio = screen.getByRole('heading', { name: 'Portfolio snapshot' })

    expect(needsAttention.compareDocumentPosition(recentActivity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(recentActivity.compareDocumentPosition(portfolio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const attentionRows = screen.getAllByRole('listitem').filter((node) => node.getAttribute('data-attention-row-id'))
    expect(attentionRows).toHaveLength(2)
    expect(attentionRows[0]?.getAttribute('data-overdue')).toBe('true')
    expect(within(attentionRows[0]).getByText('Insurance')).toBeTruthy()
    expect(within(attentionRows[0]).getByText('Home Insurance')).toBeTruthy()
    expect(within(attentionRows[1]).getByText('Mortgage')).toBeTruthy()
    expect(within(attentionRows[1]).getByText('Maple Mortgage')).toBeTruthy()

    const recentRows = screen.getAllByRole('listitem').filter((node) => node.getAttribute('data-recent-activity-row-id'))
    expect(recentRows).toHaveLength(2)
    expect(within(recentRows[0]).getByText('Completed')).toBeTruthy()
    expect(within(recentRows[1]).getByText('Manual override')).toBeTruthy()
    expect(within(recentRows[1]).getByText('Paid on Mar 9, 2026')).toBeTruthy()

    expect(screen.getAllByRole('link', { name: /Open events/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Maple Mortgage' }).length).toBeGreaterThan(0)
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
