// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from '../features/theme/theme-provider'

const THEME_STORAGE_KEY = 'omniledger-theme'

function ThemeProbe() {
  const { theme, toggleTheme, setTheme } = useTheme()

  return (
    <>
      <span data-testid="theme-value">{theme}</span>
      <button type="button" onClick={toggleTheme}>Toggle theme</button>
      <button type="button" onClick={() => setTheme('light')}>Light theme</button>
      <button type="button" onClick={() => setTheme('dark')}>Dark theme</button>
    </>
  )
}

describe('theme provider boot and persistence', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    delete document.documentElement.dataset.theme
    vi.restoreAllMocks()

    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
    } else {
      delete (window as Window & typeof globalThis & { matchMedia?: Window['matchMedia'] }).matchMedia
    }
  })

  it('boots in light mode without saved state and does not consult OS theme APIs', () => {
    const matchMedia = vi.fn(() => {
      throw new Error('matchMedia should not be called for theme boot')
    })

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMedia,
    })

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value').textContent).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(matchMedia).not.toHaveBeenCalled()
  })

  it('restores a saved explicit theme choice on mount', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value').textContent).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('changes theme only through explicit provider actions and persists the choice', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(screen.getByTestId('theme-value').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Light theme' }))
    expect(screen.getByTestId('theme-value').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })
})
