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

  it('shows one row per linked financial item without expanding into occurrences', async () => {
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
              {
                id: 'fin-2',
                user_id: 'owner-1',
                item_type: 'FinancialItem',
                type: 'Income',
                title: 'Rent',
                attributes: { name: 'Rent' },
                updated_at: '2026-02-20T00:00:00.000Z',
              },
            ],
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
              { id: 'fin-1', item_type: 'FinancialItem', type: 'Commitment', title: 'Mortgage', attributes: { name: 'Mortgage' }, updated_at: '2026-02-20T00:00:00.000Z' },
              { id: 'fin-2', item_type: 'FinancialItem', type: 'Income', title: 'Rent', attributes: { name: 'Rent' }, updated_at: '2026-02-20T00:00:00.000Z' },
            ],
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

    await screen.findByRole('button', { name: 'Commitments' })
    await userEvent.click(screen.getByRole('button', { name: 'Commitments' }))

    expect(await screen.findByRole('link', { name: 'Mortgage' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Rent' })).toBeTruthy()
    expect(screen.queryByText('Current & Upcoming')).toBeNull()
    expect(screen.queryByText('Historical Ledger')).toBeNull()

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/events?status=all'), expect.anything())
    })
  })

  it('shows linked financial item cards even when occurrence fetch would be empty', async () => {
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

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderItemDetail()

    await screen.findByRole('button', { name: 'Commitments' })
    await userEvent.click(screen.getByRole('button', { name: 'Commitments' }))

    expect(await screen.findByRole('link', { name: 'Mortgage' })).toBeTruthy()
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
