// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../app/shell/app-shell'
import { UserSwitcher } from '../app/shell/user-switcher'
import { CompleteEventRowAction } from '../features/events/complete-event-row-action'
import { ItemSoftDeleteDialog } from '../features/items/item-soft-delete-dialog'
import { ToastProvider } from '../features/ui/toast-provider'
import i18n from '../lib/i18n'
import { actorSensitiveQueryRoots } from '../lib/query-keys'
import { ItemEditPage } from '../pages/items/item-edit-page'

const safetyCopy = {
  policyDenied: i18n.t('safety.policyDenied'),
  invalidLens: i18n.t('safety.invalidLens'),
}

const setAllUsersMock = vi.fn(async () => undefined)
const setLensUserMock = vi.fn(async () => undefined)
const originalFetch = globalThis.fetch

let authState: {
  session: {
    id: string
    username: string
    email: string
    role: 'user' | 'admin'
  } | null
  sessionScope: {
    actorUserId: string | null
    actorRole: 'user' | 'admin'
    mode: 'owner' | 'all'
    lensUserId: string | null
  } | null
}

let adminScopeState: {
  isAdmin: boolean
  mode: 'all' | 'owner'
  lensUserId: string | null
  users: Array<{ id: string; username: string; email: string }>
  isLoadingUsers: boolean
  isUpdatingScope: boolean
  updateError: string | null
}

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    session: authState.session,
    sessionScope: authState.sessionScope,
    sessionExpired: false,
  }),
}))

vi.mock('../features/admin-scope/admin-scope-context', () => ({
  useAdminScope: () => ({
    ...adminScopeState,
    setAllUsers: setAllUsersMock,
    setLensUser: setLensUserMock,
  }),
}))

vi.mock('../app/shell/language-switcher', () => ({
  LanguageSwitcher: () => <div>language-switcher</div>,
}))

vi.mock('../features/auth/session-expired-banner', () => ({
  SessionExpiredBanner: () => <div>session-expired</div>,
}))

function renderShell(pathname = '/dashboard') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
          {
            path: 'dashboard',
            element: <p>Dashboard route</p>,
          },
          {
            path: 'items',
            element: <p>Items route</p>,
          },
          {
            path: 'events',
            element: <p>Events route</p>,
          },
        ],
      },
    ],
    { initialEntries: [pathname] },
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function renderSwitcher(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UserSwitcher />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderEventAction() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <CompleteEventRowAction eventId="event-1" itemId="item-1" />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

function renderItemEditPage(initialPath = '/items/item-1/edit') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const router = createMemoryRouter(
    [
      { path: '/items/:itemId/edit', element: <ItemEditPage /> },
      { path: '/items/:itemId', element: <p>detail page</p> },
    ],
    { initialEntries: [initialPath] },
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

function renderSoftDeleteDialog(props: Omit<ComponentProps<typeof ItemSoftDeleteDialog>, 'open'> & { open?: boolean }) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <ItemSoftDeleteDialog open={props.open ?? true} itemLabel={props.itemLabel} pending={props.pending} errorText={props.errorText} onCancel={props.onCancel} onConfirm={props.onConfirm} />
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('admin safety signals', () => {
  beforeEach(() => {
    authState = {
      session: {
        id: 'admin-1',
        username: 'admin-alpha',
        email: 'admin@example.com',
        role: 'admin',
      },
      sessionScope: {
        actorUserId: 'admin-1',
        actorRole: 'admin',
        mode: 'all',
        lensUserId: null,
      },
    }

    adminScopeState = {
      isAdmin: true,
      mode: 'all',
      lensUserId: null,
      users: [
        { id: 'user-1', username: 'alpha', email: 'alpha@example.com' },
        { id: 'user-2', username: 'beta', email: 'beta@example.com' },
      ],
      isLoadingUsers: false,
      isUpdatingScope: false,
      updateError: null,
    }
  })

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    setAllUsersMock.mockReset()
    setLensUserMock.mockReset()
    vi.restoreAllMocks()
  })

  it('keeps admin actor and lens tuple visible across dashboard, items, and events routes', async () => {
    renderShell('/dashboard')

    expect(screen.getByText('Dashboard route')).toBeTruthy()
    expect(screen.getByText('Admin mode active - Actor: admin-alpha | Lens: All users')).toBeTruthy()

    await userEvent.click(screen.getByRole('link', { name: 'Items' }))
    expect(await screen.findByText('Items route')).toBeTruthy()
    expect(screen.getByText('Admin mode active - Actor: admin-alpha | Lens: All users')).toBeTruthy()

    await userEvent.click(screen.getByRole('link', { name: 'Events' }))
    expect(await screen.findByText('Events route')).toBeTruthy()
    expect(screen.getByText('Admin mode active - Actor: admin-alpha | Lens: All users')).toBeTruthy()
  })

  it('hides the admin safety banner outside admin all-data mode', () => {
    adminScopeState.mode = 'owner'
    authState.sessionScope = {
      actorUserId: 'admin-1',
      actorRole: 'admin',
      mode: 'owner',
      lensUserId: 'user-2',
    }

    renderShell('/dashboard')

    expect(screen.queryByText(/Admin mode active/)).toBeNull()
  })

  it('requires explicit confirmation before exiting admin all-data mode', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    const clearSpy = vi.spyOn(queryClient, 'clear')
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderSwitcher(queryClient)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Admin lens' }), 'user-2')

    expect(setLensUserMock).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Exit admin all-data mode?')).toBeTruthy()
    expect(screen.getByText('Confirm exit before changing lens to beta. Actor: admin-alpha | Lens: All users')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Confirm exit' }))

    expect(setLensUserMock).toHaveBeenCalledWith('user-2')
    expect(clearSpy).toHaveBeenCalledTimes(1)
    actorSensitiveQueryRoots.forEach((root) => {
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: root, refetchType: 'active' }))
    })
  })

  it('keeps admin mode unchanged when exit confirmation is canceled', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    renderSwitcher(queryClient)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Admin lens' }), 'user-1')
    expect(screen.getByRole('dialog')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Stay in admin mode' }))

    expect(setLensUserMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows actor and lens attribution on complete action button and confirmation dialog', async () => {
    renderEventAction()

    expect(screen.getByText('Actor: admin-alpha | Lens: All users')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /complete/i }))

    const chips = screen.getAllByText('Actor: admin-alpha | Lens: All users')
    expect(chips.length).toBeGreaterThanOrEqual(2)
  })

  it('uses selected lens label when admin is scoped to one user', () => {
    adminScopeState.mode = 'owner'
    adminScopeState.lensUserId = 'user-2'
    authState.sessionScope = {
      actorUserId: 'admin-1',
      actorRole: 'admin',
      mode: 'owner',
      lensUserId: 'user-2',
    }

    renderEventAction()

    expect(screen.getByText('Actor: admin-alpha | Lens: beta')).toBeTruthy()
  })

  it('shows actor and lens attribution in item soft-delete confirmation', () => {
    renderSoftDeleteDialog({ itemLabel: 'Pine Avenue', onCancel: () => undefined, onConfirm: () => undefined })

    expect(screen.getByText('Actor: admin-alpha | Lens: All users')).toBeTruthy()
  })

  it('emits one inline and one toast safety signal for policy-denied event completion', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/events/event-1/complete')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'event_completion_failed',
              category: 'not_found',
              message: 'You can only access your own records.',
              issues: [
                {
                  field: 'eventId',
                  code: 'not_found',
                  category: 'not_found',
                  message: 'You can only access your own records.',
                },
              ],
            },
          }),
          {
            status: 404,
            headers: { 'content-type': 'application/json' },
          },
        )
      }

      throw new Error(`Unhandled request: ${url}`)
    }) as typeof fetch

    renderEventAction()

    await userEvent.click(screen.getByRole('button', { name: /complete/i }))
    const completeButtons = screen.getAllByRole('button', { name: 'Complete' })
    await userEvent.click(completeButtons[completeButtons.length - 1])

    const policySignals = await screen.findAllByText(safetyCopy.policyDenied)
    expect(policySignals).toHaveLength(2)
    expect(screen.getAllByTestId('safety-toast')).toHaveLength(1)
  })

  it('blocks writes when admin lens target is invalid until reselected', async () => {
    adminScopeState.mode = 'owner'
    adminScopeState.lensUserId = 'missing-user'
    authState.sessionScope = {
      actorUserId: 'admin-1',
      actorRole: 'admin',
      mode: 'owner',
      lensUserId: 'missing-user',
    }

    globalThis.fetch = vi.fn(async () => {
      throw new Error('fetch should not be called for invalid lens blocked writes')
    }) as typeof fetch

    renderEventAction()

    await userEvent.click(screen.getByRole('button', { name: /complete/i }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByText(safetyCopy.invalidLens)).toHaveLength(2)
    expect(screen.getAllByTestId('safety-toast')).toHaveLength(1)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('shows actor and lens attribution on item edit save surfaces', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items?include_deleted=true') && method === 'GET') {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'item-1',
                item_type: 'Vehicle',
                attributes: { vin: 'ABC123', estimatedValue: 9000 },
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    }) as typeof fetch

    renderItemEditPage()

    await screen.findByText('Edit item')
    expect(screen.getByText('Actor: admin-alpha | Lens: All users')).toBeTruthy()

    await userEvent.clear(screen.getByRole('spinbutton', { name: /Estimated value/i }))
    await userEvent.type(screen.getByRole('spinbutton', { name: /Estimated value/i }), '9500')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const chips = screen.getAllByText('Actor: admin-alpha | Lens: All users')
    expect(chips.length).toBeGreaterThanOrEqual(2)
  })

  it('hides mutation attribution chips for standard user surfaces', async () => {
    authState = {
      session: {
        id: 'user-1',
        username: 'alpha',
        email: 'alpha@example.com',
        role: 'user',
      },
      sessionScope: {
        actorUserId: 'user-1',
        actorRole: 'user',
        mode: 'owner',
        lensUserId: 'user-1',
      },
    }

    adminScopeState = {
      isAdmin: false,
      mode: 'owner',
      lensUserId: 'user-1',
      users: [
        { id: 'user-1', username: 'alpha', email: 'alpha@example.com' },
      ],
      isLoadingUsers: false,
      isUpdatingScope: false,
      updateError: null,
    }

    renderEventAction()
    expect(screen.queryByTestId('target-user-chip')).toBeNull()
    cleanup()

    renderSoftDeleteDialog({ itemLabel: 'Pine Avenue', onCancel: () => undefined, onConfirm: () => undefined })
    expect(screen.queryByTestId('target-user-chip')).toBeNull()
    cleanup()

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/items?include_deleted=true') && method === 'GET') {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'item-1',
                item_type: 'Vehicle',
                attributes: { vin: 'ABC123', estimatedValue: 9000 },
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    }) as typeof fetch

    renderItemEditPage()
    await screen.findByText('Edit item')
    expect(screen.queryByTestId('target-user-chip')).toBeNull()
  })
})
