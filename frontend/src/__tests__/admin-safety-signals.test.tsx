// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../app/shell/app-shell'
import '../lib/i18n'

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
  }),
}))

vi.mock('../app/shell/user-switcher', () => ({
  UserSwitcher: () => <div>user-switcher</div>,
}))

vi.mock('../app/shell/language-switcher', () => ({
  LanguageSwitcher: () => <div>language-switcher</div>,
}))

vi.mock('../features/auth/session-expired-banner', () => ({
  SessionExpiredBanner: () => <div>session-expired</div>,
}))

function renderShell(pathname = '/dashboard') {
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

  return render(<RouterProvider router={router} />)
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
    }
  })

  afterEach(() => {
    cleanup()
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
})
