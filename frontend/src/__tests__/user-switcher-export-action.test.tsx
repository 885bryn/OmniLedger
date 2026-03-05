// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { UserSwitcher } from '../app/shell/user-switcher'
import { ToastProvider } from '../features/ui/toast-provider'
import { API_BASE_URL, resolveApiBaseUrl } from '../lib/api-client'

const { logoutMock, adminScopeState } = vi.hoisted(() => ({
  logoutMock: vi.fn(async () => undefined),
  adminScopeState: {
    isAdmin: false,
    mode: 'owner' as 'owner' | 'all',
    lensUserId: 'user-1' as string | null,
    users: [] as Array<{ id: string; username: string; email: string }>,
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
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UserSwitcher />
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
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
    vi.useRealTimers()
  })

  it('shows export action and triggers export endpoint for a standard user', async () => {
    renderUserSwitcher()

    const exportButton = screen.getByRole('button', { name: 'Export Backup' })
    expect(exportButton).toBeTruthy()

    await userEvent.click(exportButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/exports/backup.xlsx`, {
        method: 'GET',
        credentials: 'include',
      })
    })

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:download-url')
    expect(screen.getByText('Backup is ready and download has started.')).toBeTruthy()
    expect(screen.getByTestId('toast').textContent).toContain('Export complete. Download started.')
  })

  it('shows pending state immediately, keeps button disabled, and reveals still-working hint', async () => {
    let release: () => void = () => {}
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
    fireEvent.click(exportButton)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Exporting...' }).hasAttribute('disabled')).toBe(true)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Exporting...' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await waitFor(
      () => {
        expect(screen.getByRole('status').textContent).toContain('Still working on your backup. Keep this page open.')
      },
      { timeout: 5000 },
    )

    release()
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Backup is ready and download has started.')
    })
  }, 10000)

  it('shows session guidance first and escalates recovery copy after repeated failures', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    renderUserSwitcher()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Export Backup' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Session expired before export finished. Sign in again, then retry.')
    })

    await user.click(screen.getByRole('button', { name: 'Retry export' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Still failing after retries. Refresh your session, then retry.')
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
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/exports/backup.xlsx`, {
        method: 'GET',
        credentials: 'include',
      })
    })

    expect(screen.getByText('Export complete for all users. Actor: alpha | Lens: All users.')).toBeTruthy()
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
    expect(path).toBe(`${API_BASE_URL}/exports/backup.xlsx`)
    expect(requestInit).toEqual({ method: 'GET', credentials: 'include' })
    expect(requestInit).not.toHaveProperty('body')
  })
})

describe('resolveApiBaseUrl', () => {
  it('prefers explicit VITE_API_BASE_URL over all other values', () => {
    expect(
      resolveApiBaseUrl({
        VITE_API_BASE_URL: 'https://hact.example.com/api',
        VITE_NAS_STATIC_IP: '192.168.1.40',
      }),
    ).toBe('https://hact.example.com/api')
  })

  it('derives production-style target from VITE_NAS_STATIC_IP when explicit base URL is absent', () => {
    expect(resolveApiBaseUrl({ VITE_NAS_STATIC_IP: '192.168.1.40' })).toBe('http://192.168.1.40:8080')
  })
})
