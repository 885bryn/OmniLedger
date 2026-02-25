import { type ReactNode, createContext, useContext, useMemo, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './language-switcher'
import { UserSwitcher } from './user-switcher'

type SidebarContextValue = {
  open: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const value = useMemo(
    () => ({
      open,
      toggle: () => setOpen((current) => !current),
    }),
    [open],
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

function useSidebar() {
  const context = useContext(SidebarContext)

  if (!context) {
    throw new Error('Sidebar context is missing. Wrap app shell with SidebarProvider.')
  }

  return context
}

function NavContent() {
  const { t } = useTranslation()

  const navItems = [
    { to: '/dashboard', label: t('navigation.dashboard') },
    { to: '/items', label: t('navigation.items') },
    { to: '/events', label: t('navigation.events') },
  ]

  return (
    <nav className="space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [
              'block rounded-lg px-3 py-2 text-sm transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            ].join(' ')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function LayoutFrame() {
  const { t } = useTranslation()
  const { open, toggle } = useSidebar()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
        <aside
          className={[
            'border-r border-border bg-card/95 p-4 shadow-sm backdrop-blur md:static md:block md:w-64 md:translate-x-0',
            'fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-200',
            open ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <Link to="/dashboard" className="mb-6 block rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-wide text-primary">
            {t('shell.workspace')}
          </Link>
          <NavContent />
        </aside>

        {open ? <button className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={toggle} aria-label="Close menu" /> : null}

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground md:hidden"
                onClick={toggle}
                aria-label="Toggle menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <p className="text-sm font-medium">{t('shell.title')}</p>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <UserSwitcher />
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

export function AppShell() {
  return (
    <SidebarProvider>
      <LayoutFrame />
    </SidebarProvider>
  )
}
