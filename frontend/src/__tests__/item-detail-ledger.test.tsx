// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  useAdminScope: () => ({
    isAdmin: false,
    mode: 'owner',
    lensUserId: null,
    users: [],
  }),
}))

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

function renderItemDetail(initialPath = '/items/asset-1') {
  const queryClient = createTestQueryClient()
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

describe('item detail ledger', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('splits linked occurrence rows into Current & Upcoming and Historical Ledger', async () => {
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

      if (url.includes('/events?') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            groups: [
              {
                due_date: '2026-03-15',
                events: [
                  {
                    id: 'projected-fin-1-2026-03-15',
                    item_id: 'fin-1',
                    type: 'Mortgage',
                    amount: 1200,
                    due_date: '2026-03-15',
                    status: 'Pending',
                    updated_at: '2026-02-20T00:00:00.000Z',
                    source_state: 'projected',
                  },
                ],
              },
              {
                due_date: '2026-01-15',
                events: [
                  {
                    id: 'event-fin-2-2026-01-15',
                    item_id: 'fin-2',
                    type: 'Rent',
                    amount: 800,
                    due_date: '2026-01-15',
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

    renderItemDetail()

    await screen.findByRole('button', { name: 'Commitments' })
    await userEvent.click(screen.getByRole('button', { name: 'Commitments' }))

    await screen.findByText('Current & Upcoming')
    const currentSection = screen.getByText('Current & Upcoming').closest('section')
    const historicalSection = screen.getByText('Historical Ledger').closest('section')

    if (!currentSection || !historicalSection) {
      throw new Error('Expected ledger sections to be rendered')
    }

    expect(within(currentSection).getAllByText('Mortgage').length).toBeGreaterThan(0)
    expect(within(currentSection).getByText('Projected')).toBeTruthy()
    expect(within(historicalSection).getAllByText('Rent').length).toBeGreaterThan(0)
    expect(within(historicalSection).getByText('Persisted')).toBeTruthy()
    expect(within(historicalSection).getByText('Edited occurrence')).toBeTruthy()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/events?status=all'), expect.anything())
    })
  })
})
