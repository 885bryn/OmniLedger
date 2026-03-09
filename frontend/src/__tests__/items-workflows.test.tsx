// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { Navigate, RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'

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

vi.mock('../features/ui/toast-provider', () => ({
  useToast: () => ({
    pushSafetyToast: vi.fn(),
  }),
}))

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
  function DetailRouteState() {
    const location = useLocation()
    return <div data-testid="detail-route-state">detail route {JSON.stringify(location.state ?? null)}</div>
  }

  const queryClient = createTestQueryClient()
  const router = createMemoryRouter(
    [
      { path: '/', element: ui },
      { path: '/items', element: <div>items route</div> },
      { path: '/items/:itemId', element: <DetailRouteState /> },
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

function renderCreateRoute(initialPath: string) {
  function LegacyCreateWizardRedirect() {
    const location = useLocation()
    return <Navigate to={`/items/create${location.search}`} replace />
  }

  function DetailRouteState() {
    const location = useLocation()
    return <div data-testid="detail-route-state">detail route {JSON.stringify(location.state ?? null)}</div>
  }

  const queryClient = createTestQueryClient()
  const router = createMemoryRouter(
    [
      { path: '/items/create', element: <ItemCreateWizardPage /> },
      {
        path: '/items/create/wizard',
        element: <LegacyCreateWizardRedirect />,
      },
      { path: '/items/:itemId', element: <DetailRouteState /> },
    ],
    { initialEntries: [initialPath] },
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
    const listUrl = String(listCall?.[0] ?? '')

    expect(listInit?.credentials).toBe('include')
    expect(getHeaderValue(listInit?.headers, 'x-user-id')).toBeNull()
    expect(listUrl).not.toContain('cadence=')

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

    await userEvent.click(screen.getByRole('button', { name: 'Deleted' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('filter=deleted'), expect.anything())
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('include_deleted=true'), expect.anything())
    })

    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/net-status'))).toBe(false)
    expect(
      fetchMock.mock.calls
        .filter(([, init]) => (init?.method ?? 'GET') === 'GET')
        .every(([input]) => !String(input).includes('cadence=')),
    ).toBe(true)
    expect(
      fetchMock.mock.calls
        .filter(([, init]) => (init?.method ?? 'GET') === 'GET')
        .every(([input]) => !String(input).includes('active_period') && !String(input).includes('cadence_totals')),
    ).toBe(true)
  })

  it('creates a financial item using session identity without actor header injection', async () => {
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
            item_type: 'FinancialItem',
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderWithMemoryRouter(<ItemCreateWizardPage />)

    expect(screen.getByRole('combobox', { name: /financial subtype/i }).textContent).toContain('Commitment')
    await userEvent.type(screen.getByRole('textbox', { name: /Name/i }), 'Loan')
    await userEvent.type(screen.getByRole('textbox', { name: /Amount/i }), '1200')
    await userEvent.type(screen.getByLabelText(/Due date/i), '2026-03-01')
    await userEvent.click(screen.getByRole('button', { name: 'Create financial item' }))

    expect(screen.getByText('Create without linked asset?')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith('/items') && (init?.method ?? 'GET') === 'POST')).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'Create anyway' }))

    await screen.findByTestId('detail-route-state')
    expect(screen.getByTestId('detail-route-state').textContent).toContain('"highlightItemId":"created-item"')
    expect(screen.getByTestId('detail-route-state').textContent).toContain('"highlightSource":"created"')
    expect(screen.getByTestId('detail-route-state').textContent).toContain('"from":"/items"')

    const createCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith('/items') && (init?.method ?? 'GET') === 'POST')
    const createInit = createCall?.[1]

    expect(createInit?.credentials).toBe('include')
    expect(getHeaderValue(createInit?.headers, 'x-user-id')).toBeNull()

    const createBody = JSON.parse(String(createInit?.body ?? '{}')) as {
      user_id?: string
      item_type?: string
      type?: string
      frequency?: string
      parent_item_id?: string | null
      confirm_unlinked_asset?: boolean
      attributes?: {
        name?: string
        financialSubtype?: string
        amount?: number
        billingCycle?: string
      }
    }

    expect(createBody.user_id).toBeUndefined()
    expect(createBody.item_type).toBe('FinancialItem')
    expect(createBody.type).toBe('Commitment')
    expect((createBody as Record<string, unknown>).cadence).toBeUndefined()
    expect((createBody as Record<string, unknown>).selected_cadence).toBeUndefined()
    expect((createBody as Record<string, unknown>).display_cadence).toBeUndefined()
    expect((createBody as Record<string, unknown>).summary_cadence).toBeUndefined()
    expect((createBody as Record<string, unknown>).summary).toBeUndefined()
    expect((createBody as Record<string, unknown>).active_period).toBeUndefined()
    expect((createBody as Record<string, unknown>).active_periods).toBeUndefined()
    expect((createBody as Record<string, unknown>).cadence_totals).toBeUndefined()
    expect(createBody.frequency).toBe('monthly')
    expect(createBody.parent_item_id).toBeNull()
    expect(createBody.confirm_unlinked_asset).toBe(true)
    expect(createBody.attributes?.name).toBe('Loan')
    expect(createBody.attributes?.financialSubtype).toBe('Commitment')
    expect((createBody.attributes as Record<string, unknown> | undefined)?.cadence).toBeUndefined()
    expect((createBody.attributes as Record<string, unknown> | undefined)?.selected_cadence).toBeUndefined()
    expect((createBody.attributes as Record<string, unknown> | undefined)?.display_cadence).toBeUndefined()
    expect((createBody.attributes as Record<string, unknown> | undefined)?.active_period).toBeUndefined()
    expect((createBody.attributes as Record<string, unknown> | undefined)?.active_periods).toBeUndefined()
    expect((createBody.attributes as Record<string, unknown> | undefined)?.summary).toBeUndefined()
    expect((createBody.attributes as Record<string, unknown> | undefined)?.cadence_totals).toBeUndefined()
    expect(createBody.attributes?.amount).toBe(1200)
    expect(createBody.attributes?.billingCycle).toBe('monthly')
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/net-status'))).toBe(false)
  })

  it('keeps legacy wizard route functional and uses the guided single form', async () => {
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
            item_type: 'FinancialItem',
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderCreateRoute('/items/create/wizard?item_type=FinancialIncome&parent_item_id=asset-1')

    await waitFor(() => {
      expect(screen.queryByText(/Step \d+ of \d+/i)).toBeNull()
    })

    expect(screen.getByRole('combobox', { name: /billing cycle/i })).toBeTruthy()
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
    await userEvent.clear(screen.getByRole('textbox', { name: /Estimated value/i }))
    await userEvent.type(screen.getByRole('textbox', { name: /Estimated value/i }), '9500')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Save changes' })[1])

    const patchCall = fetchMock.mock.calls.find(([input, requestInit]) => String(input).includes('/items/item-1') && (requestInit?.method ?? 'GET') === 'PATCH')
    const patchBodyRaw = patchCall?.[1]?.body
    const patchBody = typeof patchBodyRaw === 'string' ? JSON.parse(patchBodyRaw) as Record<string, unknown> : {}

    expect(patchBody.cadence).toBeUndefined()
    expect(patchBody.selected_cadence).toBeUndefined()
    expect(patchBody.display_cadence).toBeUndefined()
    expect(patchBody.summary_cadence).toBeUndefined()
    expect(patchBody.summary).toBeUndefined()
    expect(patchBody.active_period).toBeUndefined()
    expect(patchBody.active_periods).toBeUndefined()
    expect(patchBody.cadence_totals).toBeUndefined()

    expect(await screen.findByText(/Cannot update a soft-deleted item\./)).toBeTruthy()
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

      if (url.includes('/items/item-1/net-status') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            id: 'item-1',
            item_type: 'RealEstate',
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

  it('deletes selected linked commitments when deleting an asset parent', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items?') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            items: [
              {
                id: 'asset-1',
                item_type: 'RealEstate',
                attributes: { address: 'Sandbox Family SUV' },
                updated_at: '2026-02-24T00:00:00.000Z',
              },
            ],
            total_count: 1,
          },
        })
      }

      if (url.includes('/items/asset-1/net-status') && method === 'GET') {
        return createResponse({
          status: 200,
          json: {
            id: 'asset-1',
            item_type: 'RealEstate',
            child_commitments: [
              {
                id: 'item-commitment-1',
                item_type: 'FinancialItem',
                type: 'Commitment',
                attributes: { name: 'Sandbox auto insurance', amount: 350 },
                updated_at: '2026-02-24T00:00:00.000Z',
              },
            ],
            summary: {
              monthly_obligation_total: 350,
              monthly_income_total: 0,
              net_monthly_cashflow: -350,
              excluded_row_count: 0,
            },
          },
        })
      }

      if (url.includes('/items/asset-1') && method === 'DELETE') {
        return createResponse({ status: 200, json: { id: 'asset-1', is_deleted: true } })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderWithMemoryRouter(<ItemListPage />)

    await screen.findByText('Sandbox Family SUV')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByText('Sandbox auto insurance')

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    await userEvent.click(deleteButtons[1])

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        ([input, init]) => String(input).includes('/items/asset-1') && (init?.method ?? 'GET') === 'DELETE',
      )

      expect(deleteCall).toBeTruthy()
      const rawBody = deleteCall?.[1]?.body
      const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : {}
      expect(body.cascade_delete_ids).toEqual(['item-commitment-1'])
      expect(body.cadence).toBeUndefined()
      expect(body.selected_cadence).toBeUndefined()
      expect(body.display_cadence).toBeUndefined()
      expect(body.summary_cadence).toBeUndefined()
      expect(body.summary).toBeUndefined()
      expect(body.active_period).toBeUndefined()
      expect(body.active_periods).toBeUndefined()
      expect(body.cadence_totals).toBeUndefined()
    })
  })

  it('restores deleted item from deleted filter list', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items?') && method === 'GET') {
        const isDeletedFilter = url.includes('filter=deleted')
        const isCommitmentFilter = url.includes('filter=commitments')
        return createResponse({
          status: 200,
          json: {
            items: isDeletedFilter
              ? [
                  {
                    id: 'item-1',
                    item_type: 'FinancialItem',
                    title: 'Condo water',
                    type: 'Commitment',
                    linked_asset_item_id: 'asset-1',
                    attributes: { name: 'Condo water', financialSubtype: 'Commitment', _deleted_at: '2026-02-24T00:00:00.000Z' },
                    updated_at: '2026-02-24T00:00:00.000Z',
                  },
                ]
              : isCommitmentFilter
                ? [
                    {
                      id: 'item-1',
                      item_type: 'FinancialItem',
                      title: 'Condo water',
                      type: 'Commitment',
                      linked_asset_item_id: 'asset-1',
                      attributes: { name: 'Condo water', financialSubtype: 'Commitment' },
                      updated_at: '2026-02-24T00:00:00.000Z',
                    },
                  ]
                : [],
            total_count: isDeletedFilter || isCommitmentFilter ? 1 : 0,
          },
        })
      }

      if (url.includes('/items/item-1/restore') && method === 'PATCH') {
        return createResponse({
          status: 200,
          json: {
            id: 'item-1',
            item_type: 'FinancialItem',
            title: 'Condo water',
            type: 'Commitment',
            linked_asset_item_id: 'asset-1',
            attributes: { name: 'Condo water', financialSubtype: 'Commitment' },
            was_deleted: true,
            restored_at: '2026-02-26T00:00:00.000Z',
            updated_at: '2026-02-26T00:00:00.000Z',
          },
        })
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    renderWithMemoryRouter(<ItemListPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Deleted' }))
    await screen.findByText('Condo water')
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/items/item-1/restore'), expect.objectContaining({ method: 'PATCH' }))
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('filter=commitments'), expect.anything())
    })

    await waitFor(() => {
      expect(screen.getByText('Condo water').closest('article')?.getAttribute('data-highlighted')).toBe('true')
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
