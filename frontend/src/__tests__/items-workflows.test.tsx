// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { ItemCreateWizardPage } from '../pages/items/item-create-wizard-page'
import { ItemEditPage } from '../pages/items/item-edit-page'
import { ItemListPage } from '../pages/items/item-list-page'

type MockPayload = {
  status: number
  json: unknown
}

function getHeaderValue(headers: HeadersInit | undefined, name: string) {
  if (!headers) {
    return null
  }

  const target = name.toLowerCase()

  if (headers instanceof Headers) {
    return headers.get(name)
  }

  if (Array.isArray(headers)) {
    const pair = headers.find(([key]) => key.toLowerCase() === target)
    return pair?.[1] ?? null
  }

  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === target)
  const value = match?.[1]
  return typeof value === 'string' ? value : null
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

function renderWithMemoryRouter(ui: ReactNode) {
  const queryClient = createTestQueryClient()
  const router = createMemoryRouter(
    [
      { path: '/', element: ui },
      { path: '/items', element: <div>items route</div> },
      { path: '/items/:itemId', element: <div>detail route</div> },
      { path: '/items/:itemId/edit', element: <div>edit route</div> },
    ],
    { initialEntries: ['/'] },
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function renderEditRoute(initialPath = '/items/item-1/edit') {
  const queryClient = createTestQueryClient()
  const router = createMemoryRouter(
    [
      { path: '/items/:itemId/edit', element: <ItemEditPage /> },
      { path: '/items/:itemId', element: <div>detail route</div> },
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

describe('items workflows', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('loads list with session credentials, supports filter chips, and debounced search', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items?') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              {
                id: 'item-1',
                item_type: 'RealEstate',
                attributes: { address: 'Maple Street' },
                updated_at: '2026-02-24T00:00:00.000Z',
              },
            ],
            total_count: 1,
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderWithMemoryRouter(<ItemListPage />)

    await screen.findByText('Maple Street')

    const listCall = fetchMock.mock.calls.find(([input, init]) => String(input).includes('/items?') && (init?.method ?? 'GET') === 'GET')
    const listInit = listCall?.[1]

    expect(listInit?.credentials).toBe('include')
    expect(getHeaderValue(listInit?.headers, 'x-user-id')).toBeNull()

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('sort=recently_updated'), expect.anything())
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('filter=assets'), expect.anything())

    await userEvent.type(screen.getByPlaceholderText('Search by type or attribute'), 'mortgage')

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('search=mortgage'), expect.anything())
    })

    await userEvent.click(screen.getByRole('button', { name: 'Commitments' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('filter=commitments'), expect.anything())
    })
  })

  it('creates a commitment using session identity without actor header injection', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items?filter=assets') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              {
                id: 'asset-1',
                item_type: 'RealEstate',
                attributes: { address: 'Pine Avenue' },
                updated_at: '2026-02-24T00:00:00.000Z',
              },
            ],
            total_count: 1,
          },
        })
      }

      if (url.endsWith('/items') && method === 'POST') {
        return createResponse({
          status: 201,
          json: {
            id: 'created-item',
            item_type: 'FinancialCommitment',
          },
        })
      }

      if (url.includes('/items/created-item') && method === 'PATCH') {
        return createResponse({ status: 200, json: { id: 'created-item' } })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderWithMemoryRouter(<ItemCreateWizardPage />)

    await userEvent.selectOptions(screen.getByLabelText('Item type'), 'FinancialCommitment')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    await userEvent.type(screen.getByRole('textbox', { name: /Name/i }), 'Loan')
    await userEvent.type(screen.getAllByRole('spinbutton')[0], '1200')
    await userEvent.type(screen.getByLabelText(/Due date/i), '2026-03-01')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create item' }))

    await screen.findByText('detail route')

    const createCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith('/items') && (init?.method ?? 'GET') === 'POST')
    const createInit = createCall?.[1]

    expect(createInit?.credentials).toBe('include')
    expect(getHeaderValue(createInit?.headers, 'x-user-id')).toBeNull()

    const createBody = JSON.parse(String(createInit?.body ?? '{}')) as {
      user_id?: string
      item_type?: string
    }

    expect(createBody.user_id).toBeUndefined()
    expect(createBody.item_type).toBe('FinancialCommitment')
  })

  it('shows edit error feedback when update API returns issue envelope', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items?include_deleted=true') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              {
                id: 'item-1',
                item_type: 'Vehicle',
                attributes: { vin: 'ABC123', estimatedValue: 9000 },
              },
            ],
          },
        })
      }

      if (url.includes('/items/item-1') && method === 'PATCH') {
        return createResponse({
          status: 422,
          json: {
            error: {
              code: 'item_query_failed',
              category: 'invalid_state',
              message: 'Cannot update a soft-deleted item.',
              issues: [],
            },
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEditRoute()

    await screen.findByText('Edit item')
    await userEvent.clear(screen.getByRole('spinbutton', { name: /Estimated value/i }))
    await userEvent.type(screen.getByRole('spinbutton', { name: /Estimated value/i }), '9500')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Save changes' })[1])

    expect(await screen.findByText('Cannot update a soft-deleted item.')).toBeTruthy()
  })

  it('soft-delete confirms then refreshes list data', async () => {
    let listCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items?') && method === 'GET') {
        listCalls += 1
        return createResponse({
          status: 200,
          json: {
            items: [
              {
                id: 'item-1',
                item_type: 'RealEstate',
                attributes: { address: 'Maple Street' },
                updated_at: '2026-02-24T00:00:00.000Z',
              },
            ],
            total_count: 1,
          },
        })
      }

      if (url.includes('/items/item-1') && method === 'DELETE') {
        return createResponse({ status: 200, json: { id: 'item-1', is_deleted: true } })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderWithMemoryRouter(<ItemListPage />)

    await screen.findByText('Maple Street')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    await userEvent.click(deleteButtons[1])

    await waitFor(() => {
      expect(listCalls).toBeGreaterThan(1)
    })
  })

  it('warns before navigation when edit form has unsaved changes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items?include_deleted=true') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              {
                id: 'item-1',
                item_type: 'Vehicle',
                attributes: { vin: 'ABC123', estimatedValue: 9000 },
              },
            ],
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderEditRoute()

    await screen.findByText('Edit item')
    const estimatedValueInput = screen.getByLabelText('Estimated value')
    fireEvent.change(estimatedValueInput, { target: { value: '12345' } })
    const cancelLink = screen
      .getAllByRole('link', { name: 'Cancel' })
      .find((node) => node.getAttribute('href') === '/items/item-1')

    if (!cancelLink) {
      throw new Error('Expected cancel link to item detail route')
    }

    await userEvent.click(cancelLink)

    expect(await screen.findByText('You have unsaved changes. Leave this page?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stay here' })).toBeTruthy()
  })
})
