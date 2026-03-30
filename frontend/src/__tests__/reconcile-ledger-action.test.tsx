// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { ReconcileLedgerAction } from '../features/events/reconcile-ledger-action'
import { ApiClientError, apiRequest } from '../lib/api-client'

const toastMocks = vi.hoisted(() => ({
  pushSafetyToast: vi.fn(),
}))

let adminScopeState: {
  isAdmin: boolean
  mode: 'all' | 'owner'
  lensUserId: string | null
  users: Array<{ id: string; username: string; email: string }>
}

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    session: {
      username: 'tester',
      email: 'tester@example.com',
    },
  }),
}))

vi.mock('../features/admin-scope/admin-scope-context', () => ({
  useAdminScope: () => adminScopeState,
}))

vi.mock('../features/ui/toast-provider', () => ({
  useToast: () => toastMocks,
}))

vi.mock('../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../lib/api-client')>('../lib/api-client')
  return {
    ...actual,
    apiRequest: vi.fn(),
  }
})

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderAction(props?: Partial<ComponentProps<typeof ReconcileLedgerAction>>) {
  const queryClient = createTestQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <ReconcileLedgerAction
        eventId="event-1"
        itemId="item-1"
        projectedAmount={1400}
        projectedDate="2026-03-10"
        onSuccess={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  )
}

function getLocalDateIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function stubMatchMedia(isDesktop: boolean) {
  const matcher = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(min-width: 768px)' ? isDesktop : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: matcher,
  })
}

describe('reconcile ledger action', () => {
  const originalMatchMedia = window.matchMedia
  const mockedApiRequest = vi.mocked(apiRequest)

  beforeEach(() => {
    adminScopeState = {
      isAdmin: false,
      mode: 'owner',
      lensUserId: null,
      users: [],
    }
    stubMatchMedia(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    mockedApiRequest.mockReset()
    toastMocks.pushSafetyToast.mockReset()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    })
  })

  it('opens with projected amount and today date prefilled', async () => {
    mockedApiRequest.mockResolvedValue({
      id: 'event-1',
      item_id: 'item-1',
      type: 'Mortgage payment',
      due_date: '2026-03-10',
      amount: 1400,
      status: 'Completed',
      completed_at: '2026-03-24T08:00:00.000Z',
    })

    renderAction()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reconcile' }))

    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('1400')
    expect((screen.getByLabelText('Paid date') as HTMLInputElement).value).toBe(getLocalDateIso())
    expect(screen.getByText('Projected: $1,400 due Mar 10, 2026')).toBeTruthy()
  })

  it('submits while omitting cleared fields so backend defaults apply', async () => {
    mockedApiRequest.mockResolvedValue({
      id: 'event-1',
      item_id: 'item-1',
      type: 'Mortgage payment',
      due_date: '2026-03-10',
      amount: 1400,
      status: 'Completed',
      completed_at: '2026-03-24T08:00:00.000Z',
    })

    renderAction()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reconcile' }))

    await user.clear(screen.getByLabelText('Amount'))
    await user.clear(screen.getByLabelText('Paid date'))
    await user.click(screen.getByRole('button', { name: 'Save reconciliation' }))

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/events/event-1/complete', expect.objectContaining({ method: 'PATCH' }))
    })

    const payload = mockedApiRequest.mock.calls[0]?.[1]
    const body = payload && typeof payload === 'object' && 'body' in payload ? payload.body as Record<string, unknown> : {}
    expect(body).not.toHaveProperty('actual_amount')
    expect(body).not.toHaveProperty('actual_date')
  })

  it('keeps surface open with inline error and allows retry without losing values', async () => {
    mockedApiRequest
      .mockRejectedValueOnce(new ApiClientError({
        status: 422,
        code: 'event_complete_failed',
        message: 'Transition blocked',
      }))
      .mockResolvedValueOnce({
        id: 'event-1',
        item_id: 'item-1',
        type: 'Mortgage payment',
        due_date: '2026-03-10',
        amount: 1450,
        status: 'Completed',
        completed_at: '2026-03-24T08:00:00.000Z',
      })

    renderAction()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reconcile' }))

    const amountInput = screen.getByLabelText('Amount')
    await user.clear(amountInput)
    await user.type(amountInput, '1450')
    await user.click(screen.getByRole('button', { name: 'Save reconciliation' }))

    expect(await screen.findByText('Could not reconcile this row. Try again. (Transition blocked)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('1450')

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledTimes(2)
    })
  })

  it('renders mobile mode as bottom sheet with sticky action footer controls', async () => {
    stubMatchMedia(false)
    renderAction()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reconcile' }))

    const sheetContent = screen.getByTestId('reconcile-sheet-content')
    expect(sheetContent.getAttribute('data-side')).toBe('bottom')
    const footer = screen.getByTestId('reconcile-action-footer')
    expect(footer.className).toContain('sticky')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save reconciliation' })).toBeTruthy()
  })

  it('shows trigger and pending labels while submitting', async () => {
    let resolveRequest!: (value: {
      id: string
      item_id: string
      type: string
      due_date: string
      amount: number
      status: string
      completed_at: string
    }) => void
    mockedApiRequest.mockImplementation(
      () => new Promise((resolve) => {
        resolveRequest = resolve as typeof resolveRequest
      }),
    )

    renderAction()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reconcile' }))
    await user.click(screen.getByRole('button', { name: 'Save reconciliation' }))

    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeTruthy()

    resolveRequest({
      id: 'event-1',
      item_id: 'item-1',
      type: 'Mortgage payment',
      due_date: '2026-03-10',
      amount: 1400,
      status: 'Completed',
      completed_at: '2026-03-24T08:00:00.000Z',
    })
  })
})
