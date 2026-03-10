import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { subtlePageShiftVariants } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useAuth } from '../../auth/auth-context'
import { AdminSafetyBanner } from '../../features/admin-scope/admin-safety-banner'
import { SessionExpiredBanner } from '../../features/auth/session-expired-banner'
import { LanguageSwitcher } from './language-switcher'
import { ThemeToggle } from './theme-toggle'
import { UserSwitcher } from './user-switcher'

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()

  const navItems = [
    { to: '/dashboard', label: t('navigation.dashboard') },
    { to: '/items', label: t('navigation.items') },
    { to: '/events', label: t('navigation.events') },
  ]

  return (
    <nav className="space-y-1.5">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-border bg-card text-foreground shadow-sm shadow-black/5 dark:shadow-none'
                : 'border-transparent text-muted-foreground hover:border-border hover:bg-card/80 hover:text-foreground',
            )
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()
  const { sessionExpired } = useAuth()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] gap-4 px-3 py-3 md:gap-6 md:px-6 md:py-6">
        <aside className="hidden w-72 shrink-0 md:block">
          <Card className="sticky top-6 gap-0 border border-border bg-card/95 shadow-sm shadow-black/5 dark:bg-card dark:shadow-none">
            <CardContent className="px-4 py-4">
              <Link
                to="/dashboard"
                className="mb-6 block rounded-lg px-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground"
              >
                {t('shell.workspace')}
              </Link>
              <NavContent />
            </CardContent>
          </Card>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col gap-4 md:gap-6">
          <header className="sticky top-0 z-20 flex items-center justify-between rounded-xl border border-border bg-background/90 px-4 py-3 shadow-sm shadow-black/5 backdrop-blur supports-[backdrop-filter]:bg-background/85 dark:shadow-none md:px-5">
            <div className="flex items-center gap-3">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" size="icon-lg" className="rounded-lg md:hidden" aria-label="Toggle menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[20rem] border-border bg-card p-0 shadow-xl shadow-black/10 dark:shadow-none sm:max-w-[20rem]">
                  <SheetHeader className="border-b border-border px-4 py-4 text-left">
                    <SheetTitle className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      {t('shell.workspace')}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                      {t('shell.title')}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex h-full flex-col px-4 py-4">
                    <NavContent onNavigate={() => setMobileNavOpen(false)} />
                    <Card className="mt-6 border border-border bg-background shadow-sm shadow-black/5 dark:shadow-none" data-testid="mobile-theme-access" size="sm">
                      <CardContent className="flex items-center justify-between gap-3 px-3 py-3">
                        <span className="text-sm font-medium text-foreground">{t('shell.themeMenuLabel')}</span>
                        <ThemeToggle />
                      </CardContent>
                    </Card>
                  </div>
                </SheetContent>
              </Sheet>
              <p className="text-sm font-medium tracking-tight">{t('shell.title')}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex" data-testid="desktop-theme-toggle">
                <ThemeToggle />
              </div>
              <LanguageSwitcher />
              <UserSwitcher />
            </div>
          </header>

          <AdminSafetyBanner />

          <main className="flex-1 px-1 pb-6 md:px-0 md:pb-8">
            {sessionExpired ? <SessionExpiredBanner /> : null}
            <motion.div key={location.pathname} initial="initial" animate="animate" variants={subtlePageShiftVariants}>
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  )
}

export function AppShell() {
  return <LayoutFrame />
}
