import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { API_SAFETY_TOAST_EVENT, type SafetyToastCode } from '../../lib/api-client'

type ToastContextValue = {
  push: (options: { message: string; tone?: 'neutral' | 'success'; dedupeKey?: string; durationMs?: number }) => void
  pushSafetyToast: (code: SafetyToastCode) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function resolveSafetyToastMessage(code: SafetyToastCode, t: (key: string) => string) {
  if (code === 'invalid_lens') {
    return t('safety.invalidLens')
  }

  return t('safety.policyDenied')
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const lastEmitRef = useRef<{ key: string; at: number } | null>(null)

  const push = useCallback(
    ({ message, tone = 'neutral', dedupeKey, durationMs = 4200 }: { message: string; tone?: 'neutral' | 'success'; dedupeKey?: string; durationMs?: number }) => {
      const now = Date.now()
      const key = dedupeKey || `${tone}:${message}`
      const previous = lastEmitRef.current

      if (previous && previous.key === key && now - previous.at < 350) {
        return
      }

      lastEmitRef.current = { key, at: now }

      if (tone === 'success') {
        toast.success(message, { duration: durationMs, id: key, testId: 'toast' })
        return
      }

      toast.message(message, { duration: durationMs, id: key, testId: 'toast' })
    },
    [],
  )

  const pushSafetyToast = useCallback(
    (code: SafetyToastCode) => {
      const message = resolveSafetyToastMessage(code, (key) => t(key))
      const dedupeKey = `safety:${code}`

      const now = Date.now()
      const previous = lastEmitRef.current

      if (previous && previous.key === dedupeKey && now - previous.at < 350) {
        return
      }

      lastEmitRef.current = { key: dedupeKey, at: now }

      toast.warning(message, { duration: 4500, id: dedupeKey, testId: 'safety-toast' })
    },
    [t],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const onSafetyToast = (event: Event) => {
      const detail = (event as CustomEvent<{ code?: SafetyToastCode }>).detail
      const code = detail && detail.code
      if (code === 'policy_denied' || code === 'invalid_lens') {
        pushSafetyToast(code)
      }
    }

    window.addEventListener(API_SAFETY_TOAST_EVENT, onSafetyToast as EventListener)

    return () => {
      window.removeEventListener(API_SAFETY_TOAST_EVENT, onSafetyToast as EventListener)
    }
  }, [pushSafetyToast])

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      pushSafetyToast,
    }),
    [push, pushSafetyToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster closeButton offset={16} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext) ?? { push: () => undefined, pushSafetyToast: () => undefined }
}
