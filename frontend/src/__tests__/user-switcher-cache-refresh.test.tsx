// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../lib/i18n'
import { UserSwitcher } from '../app/shell/user-switcher'
import { queryKeys } from '../lib/query-keys'

const logoutMock = vi.fn(async () => undefined)

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    session: {
      id: 'user-1',
      username: 'alpha',
      email: 'alpha@example.com',
    },
    logout: logoutMock,
  }),
}))

describe('session identity cache reset controls', () => {
  afterEach(() => {
    cleanup()
    logoutMock.mockReset()
    vi.restoreAllMocks()
  })

  it('shows current session identity and clears cached query state on logout', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    queryClient.setQueryData(queryKeys.dashboard.all, { dueEvents: 2 })
    const clearSpy = vi.spyOn(queryClient, 'clear')

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UserSwitcher />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByText('Signed in as')).toBeTruthy()
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(logoutMock).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledTimes(1)
  })
})
