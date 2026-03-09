// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { ItemDetailPage } from '../pages/items/item-detail-page'

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    session: {
      username: 'Tester',
      email: 'tester@example.com',
    },
  }),
}))

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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderItemDetail(initialPath = '/items/asset-1', queryClient = createTestQueryClient()) {
  const router = createMemoryRouter(
    [
      {
        path: '/items/:itemId',
        element: <ItemDetailPage />,
      },
      { path: '/items/:itemId/edit', element: <div>edit route</div> },
      { path: '/items', element: <div>items route</div> },
    ],
    { initialEntries: [initialPath] },
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('item detail commitments panel', () => {
  const originalFetch = globalThis.fetch
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    window.matchMedia = originalMatchMedia
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    adminScopeState = {
      isAdmin: false,
      mode: 'owner',
      lensUserId: null,
      users: [],
    }
  })

  it('renders period-aware summary labels and one-time rule guidance when summary metadata exists', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items/asset-1/net-status') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            id: 'asset-1',
            item_type: 'RealEstate',
            user_id: 'owner-1',
            child_commitments: [],
            summary: {
              monthly_obligation_total: 1200,
              monthly_income_total: 1800,
              net_monthly_cashflow: 600,
              excluded_row_count: 0,
              active_period: {
                label: 'Mar 2026',
                start_date: '2026-03-01',
                end_date: '2026-03-31',
              },
              one_time_rule: {
                description: 'One-time rows count once only when due date is inside this active period.',
              },
            },
          },
        })
      }

      if (url.includes('/items?filter=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              { id: 'asset-1', item_type: 'RealEstate', attributes: { address: 'Maple Street' }, updated_at: '2026-02-20T00:00:00.000Z' },
            ],
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderItemDetail()

    expect(await screen.findByText('Obligations due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Income due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Net cashflow due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Only rows due this month are included in the active period: Mar 2026.')).toBeTruthy()
    expect(screen.getByText('One-time rows count once only when due date is inside this active period.')).toBeTruthy()
    expect(screen.getByText('Net cashflow due this month equals income due this month minus obligations due this month.')).toBeTruthy()
  })

  it('falls back to stable monthly summary wording when metadata is missing', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items/asset-1/net-status') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            id: 'asset-1',
            item_type: 'RealEstate',
            user_id: 'owner-1',
            child_commitments: [],
            summary: {
              monthly_obligation_total: 1200,
              monthly_income_total: 800,
              net_monthly_cashflow: -400,
              excluded_row_count: 0,
            },
          },
        })
      }

      if (url.includes('/items?filter=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              { id: 'asset-1', item_type: 'RealEstate', attributes: { address: 'Maple Street' }, updated_at: '2026-02-20T00:00:00.000Z' },
            ],
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderItemDetail()

    expect(await screen.findByText('Obligations due this month (current month)')).toBeTruthy()
    expect(screen.getByText('Income due this month (current month)')).toBeTruthy()
    expect(screen.getByText('Net cashflow due this month (current month)')).toBeTruthy()
    expect(screen.getByText('Only rows due this month are included in the active period: current month.')).toBeTruthy()
    expect(screen.getByText('One-time rows count once only when their due date is inside this active period.')).toBeTruthy()
  })

  it('defaults to monthly cadence and keeps obligations/income/net labels and values synchronized when switching cadence', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items/asset-1/net-status') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            id: 'asset-1',
            item_type: 'RealEstate',
            user_id: 'owner-1',
            child_commitments: [],
            summary: {
              monthly_obligation_total: 120,
              monthly_income_total: 170,
              net_monthly_cashflow: 50,
              excluded_row_count: 0,
              active_period: {
                label: 'Mar 2026',
                start_date: '2026-03-01',
                end_date: '2026-03-31',
              },
              cadence_totals: {
                recurring: {
                  obligations: { weekly: 30, monthly: 120, yearly: 1440 },
                  income: { weekly: 42, monthly: 170, yearly: 2040 },
                  net_cashflow: { weekly: 12, monthly: 50, yearly: 600 },
                  active_periods: {
                    weekly: {
                      start_date: '2026-03-08',
                      end_date: '2026-03-14',
                      label: 'Mar 8 - Mar 14',
                    },
                    monthly: {
                      start_date: '2026-03-01',
                      end_date: '2026-03-31',
                      label: 'Mar 2026',
                    },
                    yearly: {
                      start_date: '2026-01-01',
                      end_date: '2026-12-31',
                      label: '2026',
                    },
                  },
                },
                one_time_period: {
                  net_monthly_cashflow: 25,
                },
              },
            },
          },
        })
      }

      if (url.includes('/items?filter=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              { id: 'asset-1', item_type: 'RealEstate', attributes: { address: 'Maple Street' }, updated_at: '2026-02-20T00:00:00.000Z' },
            ],
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderItemDetail()

    expect(await screen.findByText('Obligations due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Income due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Net cashflow due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Linked due this month (Mar 2026)')).toBeTruthy()

    expect(screen.getByRole('button', { name: 'Selected cadence: Monthly' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Obligations due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$120(?:\.00)?/)
    expect(screen.getByText('Income due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$170(?:\.00)?/)
    expect(screen.getByText('Net cashflow due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$50(?:\.00)?/)
    expect(screen.getByText(/One-time impact \(separate from recurring net\): \+\$?25\.00/)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Selected cadence: Weekly' }))

    expect(await screen.findByText('Obligations due this week (Mar 8 - Mar 14)')).toBeTruthy()
    expect(screen.getByText('Income due this week (Mar 8 - Mar 14)')).toBeTruthy()
    expect(screen.getByText('Net cashflow due this week (Mar 8 - Mar 14)')).toBeTruthy()
    expect(screen.getByText('Linked due this week (Mar 8 - Mar 14)')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Obligations due this week (Mar 8 - Mar 14)').closest('article')?.textContent).toMatch(/\$30(?:\.00)?/)
      expect(screen.getByText('Income due this week (Mar 8 - Mar 14)').closest('article')?.textContent).toMatch(/\$42(?:\.00)?/)
      expect(screen.getByText('Net cashflow due this week (Mar 8 - Mar 14)').closest('article')?.textContent).toMatch(/\$12(?:\.00)?/)
    })

    await userEvent.click(screen.getByRole('button', { name: 'Selected cadence: Yearly' }))

    expect(await screen.findByText('Obligations due this year (2026)')).toBeTruthy()
    expect(screen.getByText('Income due this year (2026)')).toBeTruthy()
    expect(screen.getByText('Net cashflow due this year (2026)')).toBeTruthy()
    expect(screen.getByText('Linked due this year (2026)')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Obligations due this year (2026)').closest('article')?.textContent).toMatch(/\$1,440(?:\.00)?/)
      expect(screen.getByText('Income due this year (2026)').closest('article')?.textContent).toMatch(/\$2,040(?:\.00)?/)
      expect(screen.getByText('Net cashflow due this year (2026)').closest('article')?.textContent).toMatch(/\$600(?:\.00)?/)
    })
    expect(screen.getByText('Net cashflow due this year equals income due this year minus obligations due this year.')).toBeTruthy()
  })

  it('excludes out-of-period yearly obligations from monthly totals and includes full amounts when yearly cadence is active', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items/asset-1/net-status') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            id: 'asset-1',
            item_type: 'RealEstate',
            user_id: 'owner-1',
            child_commitments: [],
            summary: {
              monthly_obligation_total: 90,
              monthly_income_total: 300,
              net_monthly_cashflow: 210,
              excluded_row_count: 0,
              active_period: {
                label: 'Mar 2026',
                start_date: '2026-03-01',
                end_date: '2026-03-31',
              },
              cadence_totals: {
                recurring: {
                  obligations: { weekly: 20, monthly: 90, yearly: 1290 },
                  income: { weekly: 70, monthly: 300, yearly: 3600 },
                  net_cashflow: { weekly: 50, monthly: 210, yearly: 2310 },
                  active_periods: {
                    yearly: {
                      start_date: '2026-01-01',
                      end_date: '2026-12-31',
                      label: '2026',
                    },
                  },
                },
                one_time_period: {
                  net_monthly_cashflow: 0,
                },
              },
            },
          },
        })
      }

      if (url.includes('/items?filter=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              { id: 'asset-1', item_type: 'RealEstate', attributes: { address: 'Maple Street' }, updated_at: '2026-02-20T00:00:00.000Z' },
            ],
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderItemDetail()

    expect(await screen.findByText('Obligations due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Obligations due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$90(?:\.00)?/)
    expect(screen.getByText('Income due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$300(?:\.00)?/)
    expect(screen.getByText('Net cashflow due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$210(?:\.00)?/)

    await userEvent.click(screen.getByRole('button', { name: 'Selected cadence: Yearly' }))

    expect(await screen.findByText('Obligations due this year (2026)')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Obligations due this year (2026)').closest('article')?.textContent).toMatch(/\$1,290(?:\.00)?/)
      expect(screen.getByText('Income due this year (2026)').closest('article')?.textContent).toMatch(/\$3,600(?:\.00)?/)
      expect(screen.getByText('Net cashflow due this year (2026)').closest('article')?.textContent).toMatch(/\$2,310(?:\.00)?/)
    })
  })

  it('keeps only the latest cadence selection visible during rapid interactions', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items/asset-1/net-status') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            id: 'asset-1',
            item_type: 'RealEstate',
            user_id: 'owner-1',
            child_commitments: [],
            summary: {
              monthly_obligation_total: 100,
              monthly_income_total: 160,
              net_monthly_cashflow: 60,
              excluded_row_count: 0,
              active_period: {
                label: 'Mar 2026',
                start_date: '2026-03-01',
                end_date: '2026-03-31',
              },
              cadence_totals: {
                recurring: {
                  obligations: { weekly: 25, monthly: 100, yearly: 1200 },
                  income: { weekly: 40, monthly: 160, yearly: 1920 },
                  net_cashflow: { weekly: 15, monthly: 60, yearly: 720 },
                },
                one_time_period: {
                  net_monthly_cashflow: 0,
                },
              },
            },
          },
        })
      }

      if (url.includes('/items?filter=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              { id: 'asset-1', item_type: 'RealEstate', attributes: { address: 'Maple Street' }, updated_at: '2026-02-20T00:00:00.000Z' },
            ],
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderItemDetail()

    expect(await screen.findByText('Obligations due this month (Mar 2026)')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Selected cadence: Weekly' }))
    await userEvent.click(screen.getByRole('button', { name: 'Selected cadence: Yearly' }))
    await userEvent.click(screen.getByRole('button', { name: 'Selected cadence: Monthly' }))

    expect(await screen.findByText('Obligations due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Income due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Net cashflow due this month (Mar 2026)')).toBeTruthy()
    expect(screen.queryByText('Obligations due this week (Mar 2026)')).toBeNull()
    expect(screen.queryByText('Obligations due this year (Mar 2026)')).toBeNull()
    expect(screen.getByRole('button', { name: 'Selected cadence: Monthly' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps previous synchronized values visible and shows concise feedback when cadence transition fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items/asset-1/net-status') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            id: 'asset-1',
            item_type: 'RealEstate',
            user_id: 'owner-1',
            child_commitments: [],
            summary: {
              monthly_obligation_total: 'invalid',
              monthly_income_total: 'invalid',
              net_monthly_cashflow: 'invalid',
              excluded_row_count: 0,
              active_period: {
                label: 'Mar 2026',
                start_date: '2026-03-01',
                end_date: '2026-03-31',
              },
              cadence_totals: {
                recurring: {
                  obligations: { weekly: 20, monthly: 90, yearly: 'invalid' },
                  income: { weekly: 35, monthly: 140, yearly: 1680 },
                  net_cashflow: { weekly: 15, monthly: 50, yearly: 600 },
                },
                one_time_period: {
                  net_monthly_cashflow: -10,
                },
              },
            },
          },
        })
      }

      if (url.includes('/items?filter=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              { id: 'asset-1', item_type: 'RealEstate', attributes: { address: 'Maple Street' }, updated_at: '2026-02-20T00:00:00.000Z' },
            ],
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderItemDetail()

    expect(await screen.findByText('Obligations due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Obligations due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$90(?:\.00)?/)
    expect(screen.getByText('Income due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$140(?:\.00)?/)
    expect(screen.getByText('Net cashflow due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$50(?:\.00)?/)

    await userEvent.click(screen.getByRole('button', { name: 'Selected cadence: Yearly' }))

    expect(await screen.findByText('Item details could not be loaded.')).toBeTruthy()
    expect(screen.getByText('Obligations due this month (Mar 2026)')).toBeTruthy()
    expect(screen.queryByText('Obligations due this year (Mar 2026)')).toBeNull()
    expect(screen.getByText('Obligations due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$90(?:\.00)?/)
    expect(screen.getByText('Income due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$140(?:\.00)?/)
    expect(screen.getByText('Net cashflow due this month (Mar 2026)').closest('article')?.textContent).toMatch(/\$50(?:\.00)?/)
    expect(screen.getByText(/One-time impact \(separate from recurring net\): -\$?10\.00/)).toBeTruthy()
  })

  it('keeps all linked financial rows visible in the commitments tab while the summary count stays cadence-filtered', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items/asset-1/net-status') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            id: 'asset-1',
            item_type: 'RealEstate',
            user_id: 'owner-1',
            child_commitments: [
              {
                id: 'fin-1',
                user_id: 'owner-1',
                item_type: 'FinancialItem',
                type: 'Commitment',
                title: 'Mortgage',
                frequency: 'monthly',
                attributes: { name: 'Mortgage', dueDate: '2026-01-05' },
                updated_at: '2026-02-20T00:00:00.000Z',
              },
              {
                id: 'fin-2',
                user_id: 'owner-1',
                item_type: 'FinancialItem',
                type: 'Income',
                frequency: 'monthly',
                title: 'Salary',
                attributes: { name: 'Salary', dueDate: '2026-01-03' },
                updated_at: '2026-02-20T00:00:00.000Z',
              },
              {
                id: 'fin-3',
                user_id: 'owner-1',
                item_type: 'FinancialItem',
                type: 'Commitment',
                frequency: 'yearly',
                title: 'Annual Insurance',
                attributes: { name: 'Annual Insurance', dueDate: '2026-01-10' },
                updated_at: '2026-02-20T00:00:00.000Z',
              },
            ],
            summary: {
              monthly_obligation_total: 1200,
              monthly_income_total: 3200,
              net_monthly_cashflow: 2000,
              excluded_row_count: 0,
              active_period: {
                label: 'Mar 2026',
                start_date: '2026-03-01',
                end_date: '2026-03-31',
              },
              cadence_totals: {
                recurring: {
                  obligations: { weekly: 1200, monthly: 1200, yearly: 2700 },
                  income: { weekly: 3200, monthly: 3200, yearly: 38400 },
                  net_cashflow: { weekly: 2000, monthly: 2000, yearly: 35700 },
                  active_periods: {
                    weekly: {
                      start_date: '2026-03-08',
                      end_date: '2026-03-14',
                      label: 'Mar 8 - Mar 14',
                    },
                    monthly: {
                      start_date: '2026-03-01',
                      end_date: '2026-03-31',
                      label: 'Mar 2026',
                    },
                    yearly: {
                      start_date: '2026-01-01',
                      end_date: '2026-12-31',
                      label: '2026',
                    },
                  },
                },
              },
            },
          },
        })
      }

      if (url.includes('/items?filter=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              { id: 'asset-1', item_type: 'RealEstate', attributes: { address: 'Maple Street' }, updated_at: '2026-02-20T00:00:00.000Z' },
              { id: 'fin-1', item_type: 'FinancialItem', type: 'Commitment', title: 'Mortgage', attributes: { name: 'Mortgage' }, updated_at: '2026-02-20T00:00:00.000Z' },
              { id: 'fin-2', item_type: 'FinancialItem', type: 'Income', title: 'Salary', attributes: { name: 'Salary' }, updated_at: '2026-02-20T00:00:00.000Z' },
              { id: 'fin-3', item_type: 'FinancialItem', type: 'Commitment', title: 'Annual Insurance', attributes: { name: 'Annual Insurance' }, updated_at: '2026-02-20T00:00:00.000Z' },
            ],
          },
        })
      }

      if (url.includes('/events?') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            groups: [
              {
                due_date: '2026-03-10',
                events: [
                  {
                    id: 'event-fin-1-mar',
                    item_id: 'fin-1',
                    type: 'Mortgage',
                    amount: 1200,
                    due_date: '2026-03-10',
                    status: 'Pending',
                    updated_at: '2026-02-20T00:00:00.000Z',
                  },
                ],
              },
              {
                due_date: '2026-03-11',
                events: [
                  {
                    id: 'event-fin-2-mar',
                    item_id: 'fin-2',
                    type: 'Salary',
                    amount: 3200,
                    due_date: '2026-03-11',
                    status: 'Completed',
                    updated_at: '2026-02-20T00:00:00.000Z',
                  },
                ],
              },
              {
                due_date: '2026-06-15',
                events: [
                  {
                    id: 'event-fin-3-jun',
                    item_id: 'fin-3',
                    type: 'Annual Insurance',
                    amount: 1500,
                    due_date: '2026-06-15',
                    status: 'Pending',
                    updated_at: '2026-02-20T00:00:00.000Z',
                  },
                ],
              },
            ],
            total_count: 3,
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(min-width: 768px)' ? false : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia

    renderItemDetail()

    expect(await screen.findByText('Obligations due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Linked due this month (Mar 2026)').closest('article')?.textContent).toMatch(/2/)

    await screen.findByRole('button', { name: 'Commitments' })
    await userEvent.click(screen.getByRole('button', { name: 'Commitments' }))

    expect(await screen.findByRole('link', { name: 'Mortgage' })).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Salary' })).toBeTruthy()
      expect(screen.getByRole('link', { name: 'Annual Insurance' })).toBeTruthy()
    })
    expect(screen.queryByText('Current & Upcoming')).toBeNull()
    expect(screen.queryByText('Historical Ledger')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Overview' }))
    await userEvent.click(screen.getByRole('button', { name: 'Selected cadence: Yearly' }))
    expect(await screen.findByText('Linked due this year (2026)')).toBeTruthy()
    expect(screen.getByText('Linked due this year (2026)').closest('article')?.textContent).toMatch(/3/)
    await userEvent.click(screen.getByRole('button', { name: 'Commitments' }))
    expect(await screen.findByRole('link', { name: 'Annual Insurance' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Mortgage' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Salary' })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Overview' }))
    await userEvent.click(screen.getByRole('button', { name: 'Selected cadence: Weekly' }))
    expect(await screen.findByText('Linked due this week (Mar 8 - Mar 14)')).toBeTruthy()
    expect(screen.getByText('Linked due this week (Mar 8 - Mar 14)').closest('article')?.textContent).toMatch(/2/)
    await userEvent.click(screen.getByRole('button', { name: 'Commitments' }))
    expect(await screen.findByRole('link', { name: 'Mortgage' })).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Salary' })).toBeTruthy()
      expect(screen.getByRole('link', { name: 'Annual Insurance' })).toBeTruthy()
    })

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([request, requestInit]) => String(request).includes('/events?') && (requestInit?.method ?? 'GET') === 'GET')).toBe(true)
    })
  })

  it('keeps linked financial rows visible in the commitments tab when no in-period events exist', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items/asset-1/net-status') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            id: 'asset-1',
            item_type: 'RealEstate',
            user_id: 'owner-1',
            child_commitments: [
              {
                id: 'fin-1',
                user_id: 'owner-1',
                item_type: 'FinancialItem',
                type: 'Commitment',
                title: 'Mortgage',
                attributes: { name: 'Mortgage' },
                updated_at: '2026-02-20T00:00:00.000Z',
              },
            ],
            summary: {
              monthly_obligation_total: 1200,
              monthly_income_total: 0,
              net_monthly_cashflow: -1200,
              excluded_row_count: 0,
              active_period: {
                label: 'Mar 2026',
                start_date: '2026-03-01',
                end_date: '2026-03-31',
              },
              cadence_totals: {
                recurring: {
                  obligations: { weekly: 1200, monthly: 1200, yearly: 14400 },
                  income: { weekly: 0, monthly: 0, yearly: 0 },
                  net_cashflow: { weekly: -1200, monthly: -1200, yearly: -14400 },
                  active_periods: {
                    weekly: {
                      start_date: '2026-03-08',
                      end_date: '2026-03-14',
                      label: 'Mar 8 - Mar 14',
                    },
                    monthly: {
                      start_date: '2026-03-01',
                      end_date: '2026-03-31',
                      label: 'Mar 2026',
                    },
                    yearly: {
                      start_date: '2026-01-01',
                      end_date: '2026-12-31',
                      label: '2026',
                    },
                  },
                },
              },
            },
          },
        })
      }

      if (url.includes('/items?filter=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              { id: 'asset-1', item_type: 'RealEstate', attributes: { address: 'Maple Street' }, updated_at: '2026-02-20T00:00:00.000Z' },
              { id: 'fin-1', item_type: 'FinancialItem', type: 'Commitment', title: 'Mortgage', attributes: { name: 'Mortgage' }, updated_at: '2026-02-20T00:00:00.000Z' },
            ],
          },
        })
      }

      if (url.includes('/events?') && method === 'GET') {
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

    renderItemDetail()

    expect(await screen.findByText('Linked due this month (Mar 2026)')).toBeTruthy()
    expect(screen.getByText('Linked due this month (Mar 2026)').closest('article')?.textContent).toMatch(/0/)

    await screen.findByRole('button', { name: 'Commitments' })
    await userEvent.click(screen.getByRole('button', { name: 'Commitments' }))

    expect(await screen.findByRole('link', { name: 'Mortgage' })).toBeTruthy()
    expect(screen.queryByText('No linked financial items yet.')).toBeNull()
    expect(screen.queryByText('No current or upcoming ledger records for linked financial items.')).toBeNull()
    expect(screen.queryByText('No historical ledger records for linked financial items.')).toBeNull()
  })

  it('shows a financial item occurrence timeline with present/history and edit actions', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items/fin-1/net-status') && method === 'GET') {
        return createResponse({
          status: 422,
          json: {
            error: {
              code: 'item_net_status_failed',
              category: 'wrong_root_type',
              message: 'Net-status requires an asset root item type.',
              issues: [],
            },
          },
        })
      }

      if (url.includes('/items?filter=all') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              {
                id: 'fin-1',
                item_type: 'FinancialItem',
                type: 'Commitment',
                title: 'Mortgage',
                frequency: 'monthly',
                status: 'Active',
                attributes: { name: 'Mortgage', dueDate: '2026-03-15' },
                updated_at: '2026-02-20T00:00:00.000Z',
              },
            ],
          },
        })
      }

      if (url.includes('/events?') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            groups: [
              {
                due_date: '2026-01-15',
                events: [
                  {
                    id: 'event-fin-1-2026-01-15',
                    item_id: 'fin-1',
                    type: 'Mortgage',
                    amount: 1200,
                    due_date: '2026-01-15',
                    status: 'Pending',
                    updated_at: '2026-02-20T00:00:00.000Z',
                    source_state: 'persisted',
                  },
                ],
              },
              {
                due_date: '2026-02-15',
                events: [
                  {
                    id: 'event-fin-1-2026-02-15',
                    item_id: 'fin-1',
                    type: 'Mortgage',
                    amount: 1200,
                    due_date: '2026-02-15',
                    status: 'Completed',
                    updated_at: '2026-02-20T00:00:00.000Z',
                    source_state: 'persisted',
                    is_exception: true,
                  },
                ],
              },
            ],
            total_count: 2,
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderItemDetail('/items/fin-1')

    await screen.findByRole('button', { name: 'Commitments' })
    await userEvent.click(screen.getByRole('button', { name: 'Commitments' }))

    expect(await screen.findByRole('button', { name: /Current & Upcoming/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Historical Ledger/i })).toBeTruthy()
    expect(screen.getAllByText('Mortgage').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /Historical Ledger/i }))
    expect(await screen.findByText('Completed')).toBeTruthy()
  })

  it('refetches detail lookups for same item id when admin lens changes', async () => {
    adminScopeState = {
      isAdmin: true,
      mode: 'all',
      lensUserId: null,
      users: [
        { id: 'owner-1', username: 'owner1', email: 'owner1@example.com' },
        { id: 'owner-2', username: 'owner2', email: 'owner2@example.com' },
      ],
    }

    const lookupUrls: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items/asset-1/net-status') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            id: 'asset-1',
            item_type: 'RealEstate',
            user_id: 'owner-1',
            child_commitments: [],
            summary: {
              monthly_obligation_total: 0,
              monthly_income_total: 0,
              net_monthly_cashflow: 0,
              excluded_row_count: 0,
            },
          },
        })
      }

      if (url.includes('/items?') && method === 'GET') {
        lookupUrls.push(url)
        return createResponse({
          status: 200,
          json: {
            items: [
              { id: 'asset-1', item_type: 'RealEstate', attributes: { address: 'Maple Street' }, updated_at: '2026-02-20T00:00:00.000Z' },
            ],
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const queryClient = createTestQueryClient()
    renderItemDetail('/items/asset-1', queryClient)

    await screen.findByRole('heading', { name: /RealEstate/i })
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([request]) => String(request).includes('/items/asset-1/net-status'))).toBe(true)
    })

    adminScopeState.mode = 'owner'
    adminScopeState.lensUserId = 'owner-2'

    cleanup()
    renderItemDetail('/items/asset-1', queryClient)

    await screen.findByRole('heading', { name: /RealEstate/i })
    await waitFor(() => {
      expect(lookupUrls.length).toBeGreaterThanOrEqual(2)
    })

    expect(fetchMock.mock.calls.filter(([request]) => String(request).includes('/items/asset-1/net-status')).length).toBe(2)
    const latestLookupUrl = lookupUrls[lookupUrls.length - 1]
    expect(latestLookupUrl).toContain('scope_mode=owner')
    expect(latestLookupUrl).toContain('lens_user_id=owner-2')
  })
})
