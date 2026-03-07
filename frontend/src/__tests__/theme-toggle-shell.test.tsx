// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from '../app/shell/theme-toggle'
import { ThemeProvider } from '../features/theme/theme-provider'
import i18n from '../lib/i18n'

const THEME_STORAGE_KEY = 'omniledger-theme'

function renderThemeToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

describe('shell theme toggle', () => {
  afterEach(async () => {
    cleanup()
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    delete document.documentElement.dataset.theme
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
})
