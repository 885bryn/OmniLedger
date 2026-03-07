import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sanitizeReturnTo, useAuth } from '../../auth/auth-context'
import { ApiClientError } from '../../lib/api-client'

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
    } catch (error) {
      if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage(t('auth.register.topError'))
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
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t('auth.register.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('auth.register.subtitle')}</p>
          </div>

          <Card className="border border-border/80 bg-card shadow-[var(--shadow-surface)]">
            <CardHeader className="gap-2 border-b border-border/70">
              <CardTitle>{t('auth.register.submit')}</CardTitle>
              <CardDescription>Create a household account with the same dashboard surface language used throughout OmniLedger.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {errorMessage ? (
                <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="register-email">{t('auth.register.emailLabel')}</Label>
                  <Input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder={t('auth.register.emailPlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">{t('auth.register.passwordLabel')}</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder={t('auth.register.passwordPlaceholder')}
                  />
                </div>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? t('auth.register.submitting') : t('auth.register.submit')}
                </Button>
              </form>

              <p className="text-sm text-muted-foreground">
                {t('auth.register.loginPrompt')}{' '}
                <Link to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'} className="font-medium text-primary underline-offset-4 hover:underline">
                  {t('auth.register.loginAction')}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
