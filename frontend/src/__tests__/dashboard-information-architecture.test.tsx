// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
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

    throw new Error(`Unhandled request: ${method} ${url.pathname}${url.search}`)
  })
}

describe('dashboard information architecture', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('renders the summary-first hierarchy with attention before activity and support', async () => {
    globalThis.fetch = createDashboardFetchMock() as typeof fetch

    renderDashboardPage()

    await screen.findByRole('heading', { name: 'Current position' })

    const summary = screen.getByRole('heading', { name: 'Current position' })
    const needsAttention = screen.getByRole('heading', { name: 'Needs Attention' })
    const recentActivity = screen.getByRole('heading', { name: 'Recent Activity' })
    const portfolio = screen.getByRole('heading', { name: 'Portfolio snapshot' })

    expect(summary.compareDocumentPosition(needsAttention) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(needsAttention.compareDocumentPosition(recentActivity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(recentActivity.compareDocumentPosition(portfolio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    expect(screen.getByText('Mortgage')).toBeTruthy()
    expect(screen.getAllByText('Home Insurance').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Primary Home').length).toBeGreaterThan(0)
  })

  it('locks the summary band to a stacked mobile order instead of a cramped small-screen grid', async () => {
    globalThis.fetch = createDashboardFetchMock() as typeof fetch

    renderDashboardPage()

    await screen.findByText('Due events')

    const summaryBand = document.querySelector('[data-dashboard-summary-band="true"]') as HTMLElement | null
    expect(summaryBand).toBeTruthy()
    expect(summaryBand?.querySelector('.grid')?.className).toContain('grid-cols-1')
    expect(summaryBand?.querySelector('.grid')?.className).not.toContain('sm:grid-cols-2')

    const metricLabels = Array.from(document.querySelectorAll('[data-dashboard-metric-card="true"] p'))
      .map((node) => node.textContent?.trim())
      .filter(Boolean)

    expect(metricLabels.slice(0, 4)).toEqual(['Due events', 'Overdue', 'Due in 7 days', 'Upcoming amount'])
  })
})
