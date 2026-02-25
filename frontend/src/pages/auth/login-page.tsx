import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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

  const returnTo = useMemo(() => {
    const query = new URLSearchParams(location.search)
    return sanitizeReturnTo(query.get('returnTo'))
  }, [location.search])

  const showSessionExpiredNotice = useMemo(() => {
    const query = new URLSearchParams(location.search)
    const queryFlag = query.get('expired') === '1'
    const storedFlag = typeof window !== 'undefined' && window.sessionStorage.getItem('hact.auth.session-expired') === '1'
    return queryFlag || storedFlag
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f5f3ff,_#e2e8f0)] px-4 py-12 text-foreground">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card/95 p-6 shadow-lg backdrop-blur md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('auth.login.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('auth.login.subtitle')}</p>

        {topError ? (
          <div role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {topError}
          </div>
        ) : null}

        {showSessionExpiredNotice ? (
          <div role="alert" className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
            <p className="font-semibold">{t('auth.sessionExpired.title')}</p>
            <p className="mt-1">{t('auth.sessionExpired.body')}</p>
          </div>
        ) : null}

        {cooldownSeconds > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
            {t('auth.login.cooldown', { seconds: cooldownSeconds })}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-foreground">
            {t('auth.login.emailLabel')}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder={t('auth.login.emailPlaceholder')}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary transition focus:ring-2"
            />
            {inlineErrors.email ? <p className="mt-1 text-xs text-destructive">{inlineErrors.email}</p> : null}
          </label>

          <label className="block text-sm font-medium text-foreground">
            {t('auth.login.passwordLabel')}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder={t('auth.login.passwordPlaceholder')}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary transition focus:ring-2"
            />
            {inlineErrors.password ? <p className="mt-1 text-xs text-destructive">{inlineErrors.password}</p> : null}
          </label>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          {t('auth.login.registerPrompt')}{' '}
          <Link to={returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : '/register'} className="font-medium text-primary underline-offset-4 hover:underline">
            {t('auth.login.registerAction')}
          </Link>
        </p>
      </div>
    </div>
  )
}
