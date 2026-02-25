import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { sanitizeReturnTo, useAuth } from '../../auth/auth-context'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { register, session, loading, storeReturnTo } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const returnTo = useMemo(() => {
    const query = new URLSearchParams(location.search)
    return sanitizeReturnTo(query.get('returnTo'))
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !password) {
      setErrorMessage(t('auth.register.topError'))
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await register({
        email,
        password,
        returnTo,
      })

      navigate(result.redirectTo, { replace: true })
    } catch {
      setErrorMessage(t('auth.register.topError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#e2e8f0)] px-4 py-12 text-foreground">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card/95 p-6 shadow-lg backdrop-blur md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('auth.register.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('auth.register.subtitle')}</p>

        {errorMessage ? (
          <div role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-foreground">
            {t('auth.register.emailLabel')}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder={t('auth.register.emailPlaceholder')}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary transition focus:ring-2"
            />
          </label>

          <label className="block text-sm font-medium text-foreground">
            {t('auth.register.passwordLabel')}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder={t('auth.register.passwordPlaceholder')}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary transition focus:ring-2"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t('auth.register.submitting') : t('auth.register.submit')}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          {t('auth.register.loginPrompt')}{' '}
          <Link to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'} className="font-medium text-primary underline-offset-4 hover:underline">
            {t('auth.register.loginAction')}
          </Link>
        </p>
      </div>
    </div>
  )
}
