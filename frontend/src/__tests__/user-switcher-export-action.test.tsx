// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { UserSwitcher } from '../app/shell/user-switcher'

const { logoutMock, apiRequestMock, adminScopeState } = vi.hoisted(() => ({
  logoutMock: vi.fn(async () => undefined),
  apiRequestMock: vi.fn(),
  adminScopeState: {
    isAdmin: false,
    mode: 'owner' as 'owner' | 'all',
    lensUserId: 'user-1',
    users: [],
    isLoadingUsers: false,
    isUpdatingScope: false,
    updateError: null as string | null,
    setAllUsers: vi.fn(async () => undefined),
    setLensUser: vi.fn(async () => undefined),
  },
}))

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    session: {
      id: 'user-1',
      username: 'alpha',
      email: 'alpha@example.com',
      role: 'user',
    },
    logout: logoutMock,
  }),
}))

vi.mock('../features/admin-scope/admin-scope-context', () => ({
  useAdminScope: () => adminScopeState,
}))

vi.mock('../lib/api-client', () => ({
  apiRequest: apiRequestMock,
}))

function renderUserSwitcher() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UserSwitcher />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('user switcher export backup action', () => {
  beforeEach(() => {
    adminScopeState.isAdmin = false
    adminScopeState.mode = 'owner'
    adminScopeState.lensUserId = 'user-1'
    adminScopeState.users = []
    adminScopeState.isLoadingUsers = false
    adminScopeState.isUpdatingScope = false
    adminScopeState.updateError = null
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue({ export: { format: 'backup-xlsx' } })
  })

  afterEach(() => {
    cleanup()
    logoutMock.mockReset()
  })

  it('shows export action and triggers export endpoint for a standard user', async () => {
    renderUserSwitcher()

    const exportButton = screen.getByRole('button', { name: 'Export Backup' })
    expect(exportButton).toBeTruthy()

    await userEvent.click(exportButton)

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/exports/backup.xlsx', {
        method: 'GET',
      })
    })

    expect(screen.getByRole('status').textContent).toContain('Export started.')
  })

  it('shows pending and error feedback when export fails', async () => {
    let release: (() => void) | null = null
    apiRequestMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ export: { format: 'backup-xlsx' } })
        }),
    )

    renderUserSwitcher()

    await userEvent.click(screen.getByRole('button', { name: 'Export Backup' }))
    expect(screen.getByRole('button', { name: 'Exporting...' })).toBeTruthy()

    release?.()
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Export started.')
    })

    apiRequestMock.mockRejectedValueOnce(new Error('network down'))
    await userEvent.click(screen.getByRole('button', { name: 'Export Backup' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('network down')
    })
  })

  it('keeps export action available for admin all-data mode', async () => {
    adminScopeState.isAdmin = true
    adminScopeState.mode = 'all'
    adminScopeState.lensUserId = null
    adminScopeState.users = [
      { id: 'user-1', username: 'alpha', email: 'alpha@example.com' },
      { id: 'user-2', username: 'beta', email: 'beta@example.com' },
    ]

    renderUserSwitcher()

    await userEvent.click(screen.getByRole('button', { name: 'Export Backup' }))

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/exports/backup.xlsx', {
        method: 'GET',
      })
    })
  })

  it('keeps export request contract unchanged in admin owner-lens mode', async () => {
    adminScopeState.isAdmin = true
    adminScopeState.mode = 'owner'
    adminScopeState.lensUserId = 'user-2'
    adminScopeState.users = [
      { id: 'user-1', username: 'alpha', email: 'alpha@example.com' },
      { id: 'user-2', username: 'beta', email: 'beta@example.com' },
    ]

    renderUserSwitcher()

    await userEvent.click(screen.getByRole('button', { name: 'Export Backup' }))

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalled()
    })

    const [path, requestInit] = apiRequestMock.mock.calls[0]
    expect(path).toBe('/exports/backup.xlsx')
    expect(requestInit).toEqual({ method: 'GET' })
    expect(requestInit).not.toHaveProperty('body')
  })
})
