import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiClientError } from '../../lib/api-client'
import { sanitizeReturnTo, useAuth } from '../../auth/auth-context'

type InlineErrors = {
  email?: string
  password?: string
}

function resolveCooldownSeconds(value: number | null) {
  if (!value || value <= 0) {
    return 0
  }

  return Math.max(Math.ceil(value), 0)
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, storeReturnTo, session, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [topError, setTopError] = useState<string | null>(null)
  const [inlineErrors, setInlineErrors] = useState<InlineErrors>({})
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [showSessionExpiredNotice, setShowSessionExpiredNotice] = useState(false)

  const returnTo = useMemo(() => {
    const query = new URLSearchParams(location.search)
    return sanitizeReturnTo(query.get('returnTo'))
  }, [location.search])

  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const queryFlag = query.get('expired') === '1'
    const storedFlag = typeof window !== 'undefined' && window.sessionStorage.getItem('hact.auth.session-expired') === '1'

    setShowSessionExpiredNotice(queryFlag || storedFlag)

    if (storedFlag && typeof window !== 'undefined') {
      window.sessionStorage.removeItem('hact.auth.session-expired')
    }
  }, [location.search])

  useEffect(() => {
    storeReturnTo(returnTo)
  }, [returnTo, storeReturnTo])

  useEffect(() => {
    if (loading) {
      return
    }

    if (session) {
      navigate(returnTo || '/dashboard', { replace: true })
    }
  }, [loading, navigate, returnTo, session])

  useEffect(() => {
    if (!cooldownUntil) {
      return
    }

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [cooldownUntil])

  const cooldownSeconds = resolveCooldownSeconds(cooldownUntil ? (cooldownUntil - now) / 1000 : null)

  useEffect(() => {
    if (cooldownSeconds > 0) {
      return
    }

    setCooldownUntil(null)
  }, [cooldownSeconds])

  const isSubmitDisabled = submitting || cooldownSeconds > 0
  const emailHasError = Boolean(inlineErrors.email)
  const passwordHasError = Boolean(inlineErrors.password)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitDisabled) {
      return
    }

    if (!email.trim() || !password) {
      setTopError(t('auth.login.topError'))
      setInlineErrors({
        email: t('auth.login.inlineError'),
        password: t('auth.login.inlineError'),
      })
      setPassword('')
      return
    }

    setSubmitting(true)
    setTopError(null)
    setInlineErrors({})

    try {
      const result = await login({
        email,
        password,
        returnTo,
      })

      navigate(result.redirectTo, { replace: true })
    } catch (error) {
      setTopError(t('auth.login.topError'))
      setInlineErrors({
        email: t('auth.login.inlineError'),
        password: t('auth.login.inlineError'),
      })
      setPassword('')

      if (error instanceof ApiClientError && error.status === 429) {
        const retryAfter = Number(error.cooldown?.retry_after_seconds)
        const safeSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60
        setCooldownUntil(Date.now() + safeSeconds * 1000)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 sm:py-14">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          <div className="space-y-2 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">OmniLedger</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t('auth.login.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('auth.login.subtitle')}</p>
          </div>

          <Card className="border border-border/80 bg-card shadow-[var(--shadow-surface)]">
            <CardHeader className="gap-2 border-b border-border/70">
              <CardTitle>{t('auth.login.submit')}</CardTitle>
              <CardDescription>Use your account credentials to continue into the dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {topError ? (
                <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {topError}
                </div>
              ) : null}

              {showSessionExpiredNotice ? (
                <div role="alert" className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">{t('auth.sessionExpired.title')}</p>
                  <p className="mt-1">{t('auth.sessionExpired.body')}</p>
                </div>
              ) : null}

              {cooldownSeconds > 0 ? (
                <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  {t('auth.login.cooldown', { seconds: cooldownSeconds })}
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t('auth.login.emailLabel')}</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder={t('auth.login.emailPlaceholder')}
                    aria-invalid={emailHasError}
                    aria-describedby={emailHasError ? 'login-email-error' : undefined}
                  />
                  {inlineErrors.email ? (
                    <p id="login-email-error" className="text-xs text-destructive">
                      {inlineErrors.email}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">{t('auth.login.passwordLabel')}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder={t('auth.login.passwordPlaceholder')}
                    aria-invalid={passwordHasError}
                    aria-describedby={passwordHasError ? 'login-password-error' : undefined}
                  />
                  {inlineErrors.password ? (
                    <p id="login-password-error" className="text-xs text-destructive">
                      {inlineErrors.password}
                    </p>
                  ) : null}
                </div>

                <Button type="submit" disabled={isSubmitDisabled} className="w-full">
                  {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
                </Button>
              </form>

              <p className="text-sm text-muted-foreground">
                {t('auth.login.registerPrompt')}{' '}
                <Link to={returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : '/register'} className="font-medium text-primary underline-offset-4 hover:underline">
                  {t('auth.login.registerAction')}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
