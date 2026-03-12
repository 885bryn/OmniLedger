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

type DashboardEvent = {
  id: string
  item_id: string
  type: string
  amount: number
  due_date: string
  status: string
  updated_at: string
}

type DashboardGroup = {
  due_date: string
  events: DashboardEvent[]
}

function toDayString(base: string, offsetDays: number) {
  const date = new Date(base)
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function createResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function countEvents(groups: DashboardGroup[]) {
  return groups.reduce((total, group) => total + group.events.length, 0)
}

function createFetchMock(pendingGroups: DashboardGroup[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'

    if (url.pathname === '/events' && url.searchParams.get('status') === 'pending' && method === 'GET') {
      return createResponse({ groups: pendingGroups, total_count: countEvents(pendingGroups) })
    }

    if (url.pathname === '/events' && url.searchParams.get('status') === 'completed' && method === 'GET') {
      return createResponse({ groups: [], total_count: 0 })
    }

    if (url.pathname === '/items' && url.searchParams.get('filter') === 'assets' && method === 'GET') {
      return createResponse({ items: [], total_count: 0 })
    }

    if (url.pathname === '/items' && url.searchParams.get('filter') === 'all' && method === 'GET') {
      return createResponse({
        items: [
          { id: 'item-over-1', item_type: 'FinancialItem', type: 'Commitment', attributes: { name: 'Mortgage' }, updated_at: '2026-03-15T00:00:00.000Z' },
          { id: 'item-over-2', item_type: 'FinancialItem', type: 'Commitment', attributes: { name: 'Insurance' }, updated_at: '2026-03-15T00:00:00.000Z' },
          { id: 'item-over-3', item_type: 'FinancialItem', type: 'Commitment', attributes: { name: 'Utilities' }, updated_at: '2026-03-15T00:00:00.000Z' },
          { id: 'item-up-1', item_type: 'FinancialItem', type: 'Commitment', attributes: { name: 'Phone Bill' }, updated_at: '2026-03-15T00:00:00.000Z' },
          { id: 'item-up-2', item_type: 'FinancialItem', type: 'Commitment', attributes: { name: 'Internet Bill' }, updated_at: '2026-03-15T00:00:00.000Z' },
          { id: 'item-up-3', item_type: 'FinancialItem', type: 'Commitment', attributes: { name: 'Car Payment' }, updated_at: '2026-03-15T00:00:00.000Z' },
        ],
        total_count: 6,
      })
    }

    throw new Error(`Unhandled request: ${method} ${url.pathname}${url.search}`)
  })
}

function renderDashboardPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/events" element={<p>Events page</p>} />
          <Route path="/items/:itemId" element={<p>Item detail page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('dashboard action queue', () => {
  const originalFetch = globalThis.fetch
  const fixedNow = '2026-03-15T12:00:00.000Z'

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('splits queue into overdue and upcoming sections with locked counts, ordering, and age buckets', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(fixedNow).getTime())

    const pendingGroups: DashboardGroup[] = [
      {
        due_date: toDayString(fixedNow, -40),
        events: [
          { id: 'over-1', item_id: 'item-over-1', type: 'Mortgage', amount: 1500, due_date: toDayString(fixedNow, -40), status: 'Pending', updated_at: '2026-03-14T00:00:00.000Z' },
          { id: 'over-2', item_id: 'item-over-2', type: 'Insurance', amount: 250, due_date: toDayString(fixedNow, -10), status: 'Pending', updated_at: '2026-03-14T00:00:00.000Z' },
          { id: 'over-3', item_id: 'item-over-3', type: 'Utilities', amount: 120, due_date: toDayString(fixedNow, -3), status: 'Pending', updated_at: '2026-03-14T00:00:00.000Z' },
          { id: 'up-1', item_id: 'item-up-1', type: 'Phone', amount: 90, due_date: toDayString(fixedNow, 3), status: 'Pending', updated_at: '2026-03-14T00:00:00.000Z' },
          { id: 'up-2', item_id: 'item-up-2', type: 'Internet', amount: 80, due_date: toDayString(fixedNow, 12), status: 'Pending', updated_at: '2026-03-14T00:00:00.000Z' },
          { id: 'up-3', item_id: 'item-up-3', type: 'Car Loan', amount: 410, due_date: toDayString(fixedNow, 20), status: 'Pending', updated_at: '2026-03-14T00:00:00.000Z' },
        ],
      },
    ]

    globalThis.fetch = createFetchMock(pendingGroups) as typeof fetch
    renderDashboardPage()

    await screen.findByRole('heading', { name: /Needs Attention/i })

    const overdueSection = screen.getByTestId('dashboard-action-queue-overdue')
    const upcomingSection = screen.getByTestId('dashboard-action-queue-upcoming')

    expect(within(overdueSection).getByText('Overdue')).toBeTruthy()
    expect(within(overdueSection).getByText('3')).toBeTruthy()
    expect(within(upcomingSection).getByText('Upcoming')).toBeTruthy()
    expect(within(upcomingSection).getByText('2')).toBeTruthy()

    const overdueRows = within(overdueSection).getAllByTestId('dashboard-action-queue-row')
    expect(overdueRows).toHaveLength(3)
    expect(within(overdueRows[0]).getAllByText('Mortgage').length).toBeGreaterThan(0)
    expect(within(overdueRows[1]).getAllByText('Insurance').length).toBeGreaterThan(0)
    expect(within(overdueRows[2]).getAllByText('Utilities').length).toBeGreaterThan(0)
    expect(within(overdueRows[0]).getByText('30+d')).toBeTruthy()
    expect(within(overdueRows[1]).getByText('8-30d')).toBeTruthy()
    expect(within(overdueRows[2]).getByText('1-7d')).toBeTruthy()
  })

  it('keeps upcoming queue nearest-first within 14 days and preserves /events and /items links', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(fixedNow).getTime())

    const pendingGroups: DashboardGroup[] = [
      {
        due_date: toDayString(fixedNow, 1),
        events: [
          { id: 'up-nearest', item_id: 'item-up-1', type: 'Phone', amount: 90, due_date: toDayString(fixedNow, 1), status: 'Pending', updated_at: '2026-03-14T00:00:00.000Z' },
          { id: 'up-middle', item_id: 'item-up-2', type: 'Internet', amount: 80, due_date: toDayString(fixedNow, 7), status: 'Pending', updated_at: '2026-03-14T00:00:00.000Z' },
          { id: 'up-far', item_id: 'item-up-3', type: 'Car Loan', amount: 410, due_date: toDayString(fixedNow, 16), status: 'Pending', updated_at: '2026-03-14T00:00:00.000Z' },
        ],
      },
    ]

    globalThis.fetch = createFetchMock(pendingGroups) as typeof fetch
    renderDashboardPage()

    const upcomingSection = await screen.findByTestId('dashboard-action-queue-upcoming')
    const upcomingRows = within(upcomingSection).getAllByTestId('dashboard-action-queue-row')

    expect(upcomingRows).toHaveLength(2)
    expect(within(upcomingRows[0]).getByText('Phone')).toBeTruthy()
    expect(within(upcomingRows[1]).getByText('Internet')).toBeTruthy()
    expect(within(upcomingSection).queryByText('Car Loan')).toBeNull()

    const eventsLinks = screen.getAllByRole('link', { name: /Open events/i })
    expect(eventsLinks.length).toBeGreaterThan(0)
    expect(eventsLinks.some((link) => link.getAttribute('href') === '/events')).toBe(true)

    const itemLinks = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/items/'))
    expect(itemLinks.length).toBeGreaterThan(0)
    expect(itemLinks.some((link) => link.getAttribute('href') === '/items/item-up-1')).toBe(true)
  })
})
