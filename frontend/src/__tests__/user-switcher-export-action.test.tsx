// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { UserSwitcher } from '../app/shell/user-switcher'

const { logoutMock, adminScopeState } = vi.hoisted(() => ({
  logoutMock: vi.fn(async () => undefined),
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

const fetchMock = vi.fn<typeof fetch>()
const createObjectUrlMock = vi.fn(() => 'blob:download-url')
const revokeObjectUrlMock = vi.fn()

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

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(
      new Response(new Blob(['xlsx-bytes'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), {
        status: 200,
        headers: {
          'Content-Disposition': 'attachment; filename="backup.xlsx"',
        },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: createObjectUrlMock,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: revokeObjectUrlMock,
    })
  })

  afterEach(() => {
    cleanup()
    logoutMock.mockReset()
    createObjectUrlMock.mockReset()
    revokeObjectUrlMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('shows export action and triggers export endpoint for a standard user', async () => {
    renderUserSwitcher()

    const exportButton = screen.getByRole('button', { name: 'Export Backup' })
    expect(exportButton).toBeTruthy()

    await userEvent.click(exportButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/exports/backup.xlsx', {
        method: 'GET',
        credentials: 'include',
      })
    })

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:download-url')
    expect(screen.getByRole('status').textContent).toContain('Backup download started.')
  })

   it('shows pending state immediately and keeps button disabled until request resolves', async () => {
    let release: (() => void) | null = null
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve(
              new Response(new Blob(['xlsx-bytes']), {
                status: 200,
              }),
            )
        }),
    )

    renderUserSwitcher()

    const exportButton = screen.getByRole('button', { name: 'Export Backup' })
    await userEvent.click(exportButton)
    expect(screen.getByRole('button', { name: 'Exporting...' }).hasAttribute('disabled')).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Exporting...' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    release?.()
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Backup download started.')
    })
  })

  it('shows actionable retry guidance when export fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    renderUserSwitcher()

    await userEvent.click(screen.getByRole('button', { name: 'Export Backup' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Check your connection and session, then try again.')
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
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/exports/backup.xlsx', {
        method: 'GET',
        credentials: 'include',
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
      expect(fetchMock).toHaveBeenCalled()
    })

    const [path, requestInit] = fetchMock.mock.calls[0]
    expect(path).toBe('http://localhost:8080/exports/backup.xlsx')
    expect(requestInit).toEqual({ method: 'GET', credentials: 'include' })
    expect(requestInit).not.toHaveProperty('body')
  })
})
