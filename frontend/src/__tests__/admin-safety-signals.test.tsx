// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../app/shell/app-shell'
import { UserSwitcher } from '../app/shell/user-switcher'
import '../lib/i18n'
import { actorSensitiveQueryRoots } from '../lib/query-keys'

const setAllUsersMock = vi.fn(async () => undefined)
const setLensUserMock = vi.fn(async () => undefined)

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
})
