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
  amount: number | null
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
          {
            id: 'item-commitment-overdue',
            item_type: 'FinancialItem',
            type: 'Commitment',
            attributes: { name: 'Mortgage' },
            updated_at: '2026-03-14T00:00:00.000Z',
          },
          {
            id: 'item-income-upcoming',
            item_type: 'FinancialItem',
            type: 'Income',
            attributes: { name: 'Tenant Rent' },
            updated_at: '2026-03-13T00:00:00.000Z',
          },
          {
            id: 'item-commitment-clear',
            item_type: 'FinancialItem',
            type: 'Commitment',
            attributes: { name: 'Cloud Backup' },
            updated_at: '2026-03-12T00:00:00.000Z',
          },
          {
            id: 'asset-1',
            item_type: 'Property',
            attributes: { name: 'Primary Home' },
            updated_at: '2026-03-10T00:00:00.000Z',
          },
        ],
        total_count: 4,
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

describe('dashboard financial snapshot', () => {
  const originalFetch = globalThis.fetch
  const fixedNow = '2026-03-15T12:00:00.000Z'

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders dense item rows in stable urgency-first order with subtype, status, due, and amount metadata', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(fixedNow).getTime())

    const pendingGroups: DashboardGroup[] = [
      {
        due_date: toDayString(fixedNow, -4),
        events: [
          {
            id: 'event-overdue',
            item_id: 'item-commitment-overdue',
            type: 'Mortgage',
            amount: 1500,
            due_date: toDayString(fixedNow, -4),
            status: 'Pending',
            updated_at: '2026-03-14T00:00:00.000Z',
          },
          {
            id: 'event-upcoming',
            item_id: 'item-income-upcoming',
            type: 'Rent',
            amount: 2200,
            due_date: toDayString(fixedNow, 3),
            status: 'Pending',
            updated_at: '2026-03-14T00:00:00.000Z',
          },
        ],
      },
    ]

    globalThis.fetch = createFetchMock(pendingGroups) as typeof fetch
    renderDashboardPage()

    const section = await screen.findByTestId('dashboard-financial-snapshot')
    const rows = within(section).getAllByTestId('dashboard-financial-snapshot-row')

    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByRole('link', { name: 'Mortgage' })).toBeTruthy()
    expect(within(rows[0]).getByText('Commitment')).toBeTruthy()
    expect(within(rows[0]).getByText(/Overdue/)).toBeTruthy()
    expect(within(rows[0]).getByText(/^Due /)).toBeTruthy()
    expect(within(rows[0]).getByText('$1,500')).toBeTruthy()

    expect(within(rows[1]).getByText('Tenant Rent')).toBeTruthy()
    expect(within(rows[1]).getByText('Income')).toBeTruthy()
    expect(within(rows[1]).getByText(/Upcoming/)).toBeTruthy()
    expect(within(rows[1]).getByText('+$2,200')).toBeTruthy()

    expect(within(rows[2]).getByText('Cloud Backup')).toBeTruthy()
    expect(within(rows[2]).getByText('No pending events')).toBeTruthy()
    expect(within(rows[2]).getByText('Amount pending')).toBeTruthy()
  })

  it('keeps snapshot rows and summary/action handoffs wired to existing /items and /events workflows', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(fixedNow).getTime())

    const pendingGroups: DashboardGroup[] = [
      {
        due_date: toDayString(fixedNow, 2),
        events: [
          {
            id: 'event-upcoming',
            item_id: 'item-income-upcoming',
            type: 'Rent',
            amount: 2200,
            due_date: toDayString(fixedNow, 2),
            status: 'Pending',
            updated_at: '2026-03-14T00:00:00.000Z',
          },
        ],
      },
    ]

    globalThis.fetch = createFetchMock(pendingGroups) as typeof fetch
    renderDashboardPage()

    const section = await screen.findByTestId('dashboard-financial-snapshot')
    const row = within(section).getAllByTestId('dashboard-financial-snapshot-row')[0]
    const statusBlock = within(row).getByTestId('dashboard-financial-snapshot-status')
    const actionBlock = within(row).getByTestId('dashboard-financial-snapshot-action')

    expect(statusBlock.className).toContain('justify-between')
    expect(statusBlock.className).toContain('items-start')
    expect(within(statusBlock).getByText('Status')).toBeTruthy()
    expect(within(row).getByText('Next due')).toBeTruthy()
    expect(within(row).getByText('Amount')).toBeTruthy()
    expect(actionBlock.className).toContain('justify-end')
    expect(within(actionBlock).getByRole('link', { name: 'Open item' })).toBeTruthy()

    const snapshotItemLinks = within(section)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/items/'))
    expect(snapshotItemLinks.length).toBeGreaterThan(0)
    expect(snapshotItemLinks.some((link) => link.getAttribute('href') === '/items/item-income-upcoming')).toBe(true)

    const openEventsLinks = screen.getAllByRole('link', { name: /Open events/i })
    expect(openEventsLinks.length).toBeGreaterThan(0)
    expect(openEventsLinks.some((link) => link.getAttribute('href') === '/events')).toBe(true)
  })
})
