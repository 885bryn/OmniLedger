// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { UserSwitcher } from '../app/shell/user-switcher'
import { actorSensitiveQueryRoots, queryKeys } from '../lib/query-keys'

const logoutMock = vi.fn(async () => undefined)
const setAllUsersMock = vi.fn(async () => undefined)
const setLensUserMock = vi.fn(async () => undefined)

let authState: {
  session: {
    id: string
    username: string
    email: string
    role?: 'user' | 'admin'
  }
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
    logout: logoutMock,
  }),
}))

vi.mock('../features/admin-scope/admin-scope-context', () => ({
  useAdminScope: () => ({
    ...adminScopeState,
    setAllUsers: setAllUsersMock,
    setLensUser: setLensUserMock,
  }),
}))

function renderSwitcher(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UserSwitcher />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('admin lens controls', () => {
  beforeEach(() => {
    authState = {
      session: {
        id: 'user-1',
        username: 'alpha',
        email: 'alpha@example.com',
        role: 'user',
      },
    }

    adminScopeState = {
      isAdmin: false,
      mode: 'owner',
      lensUserId: 'user-1',
      users: [],
      isLoadingUsers: false,
      isUpdatingScope: false,
      updateError: null,
    }
  })

  afterEach(() => {
    cleanup()
    logoutMock.mockReset()
    setAllUsersMock.mockReset()
    setLensUserMock.mockReset()
    vi.restoreAllMocks()
  })

  it('keeps lens controls hidden for non-admin sessions', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    renderSwitcher(queryClient)

    expect(screen.getByText('Signed in as')).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: 'Admin lens' })).toBeNull()
  })

  it('lets admin switch between all-users and specific-user lenses', async () => {
    authState.session.role = 'admin'
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

    const select = screen.getByRole('combobox', { name: 'Admin lens' })
    expect(select).toBeTruthy()

    await userEvent.selectOptions(select, 'user-2')
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm exit' }))
    expect(setLensUserMock).toHaveBeenCalledWith('user-2')
    expect(clearSpy).toHaveBeenCalledTimes(1)
    actorSensitiveQueryRoots.forEach((root) => {
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: root, refetchType: 'active' }))
    })

    adminScopeState.mode = 'owner'
    adminScopeState.lensUserId = 'user-2'
    cleanup()
    renderSwitcher(queryClient)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Admin lens' }), 'all')
    expect(setAllUsersMock).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledTimes(2)
  })

  it('partitions item detail cache entries by admin scope lens', () => {
    const queryClient = new QueryClient()
    const allScopeKey = queryKeys.items.detail('asset-1', { mode: 'all', lensUserId: null })
    const ownerScopeKey = queryKeys.items.detail('asset-1', { mode: 'owner', lensUserId: 'user-2' })

    queryClient.setQueryData(allScopeKey, { owner: 'all-users' })
    queryClient.setQueryData(ownerScopeKey, { owner: 'user-2' })

    expect(allScopeKey).not.toEqual(ownerScopeKey)
    expect(queryClient.getQueryData(allScopeKey)).toEqual({ owner: 'all-users' })
    expect(queryClient.getQueryData(ownerScopeKey)).toEqual({ owner: 'user-2' })
  })
})
