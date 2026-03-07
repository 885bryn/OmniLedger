// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../app/shell/app-shell'
import { ThemeToggle } from '../app/shell/theme-toggle'
import { ThemeProvider } from '../features/theme/theme-provider'
import i18n from '../lib/i18n'

const THEME_STORAGE_KEY = 'omniledger-theme'
const originalMatchMedia = window.matchMedia

const authState = vi.hoisted(() => ({
  sessionExpired: false,
}))

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    sessionExpired: authState.sessionExpired,
  }),
}))

vi.mock('../features/admin-scope/admin-safety-banner', () => ({
  AdminSafetyBanner: () => null,
}))

vi.mock('../features/auth/session-expired-banner', () => ({
  SessionExpiredBanner: () => null,
}))

vi.mock('../app/shell/language-switcher', () => ({
  LanguageSwitcher: () => <div>language-switcher</div>,
}))

vi.mock('../app/shell/user-switcher', () => ({
  UserSwitcher: () => <div>user-switcher</div>,
}))

function renderThemeToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

function renderShell(initialEntries: string[] = ['/dashboard']) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <ThemeProvider>
            <AppShell />
          </ThemeProvider>
        ),
        children: [
          {
            path: 'dashboard',
            element: <p>Dashboard route</p>,
          },
        ],
      },
    ],
    { initialEntries },
  )

  return render(<RouterProvider router={router} />)
}

describe('shell theme toggle', () => {
  afterEach(async () => {
    cleanup()
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    delete document.documentElement.dataset.theme
    authState.sessionExpired = false
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    })
    await i18n.changeLanguage('en')
  })

  it('switches themes manually with opposite-theme labels and active icon state', async () => {
    const user = userEvent.setup()

    renderThemeToggle()

    const lightToggle = screen.getByRole('button', { name: 'Switch to dark theme' })
    expect(lightToggle.getAttribute('data-active-theme')).toBe('light')
    expect(lightToggle.getAttribute('title')).toBe('Switch to dark theme')

    await user.click(lightToggle)

    const darkToggle = screen.getByRole('button', { name: 'Switch to light theme' })
    expect(darkToggle.getAttribute('data-active-theme')).toBe('dark')
    expect(darkToggle.getAttribute('title')).toBe('Switch to light theme')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('restores a saved theme and localizes the accessible label', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    await i18n.changeLanguage('zh')

    renderThemeToggle()

    const toggle = screen.getByRole('button', { name: '切换到浅色主题' })
    expect(toggle.getAttribute('data-active-theme')).toBe('dark')
    expect(toggle.getAttribute('title')).toBe('切换到浅色主题')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('wires desktop header and mobile menu toggles through shared persisted theme state without OS preference logic', async () => {
    const user = userEvent.setup()
    const matchMedia = vi.fn(() => {
      throw new Error('matchMedia should not be consulted for shell theme switching')
    })

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMedia,
    })

    const firstRender = renderShell()

    expect(await screen.findByText('Dashboard route')).toBeTruthy()

    const desktopToggle = within(screen.getByTestId('desktop-theme-toggle')).getByRole('button', {
      name: 'Switch to dark theme',
    })

    await user.click(desktopToggle)

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(matchMedia).not.toHaveBeenCalled()

    firstRender.unmount()

    renderShell()

    const restoredDesktopToggle = within(screen.getByTestId('desktop-theme-toggle')).getByRole('button', {
      name: 'Switch to light theme',
    })

    expect(restoredDesktopToggle.getAttribute('data-active-theme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Toggle menu' }))

    const mobileToggle = within(screen.getByTestId('mobile-theme-access')).getByRole('button', {
      name: 'Switch to light theme',
    })

    await user.click(mobileToggle)

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(matchMedia).not.toHaveBeenCalled()
  })
})
