import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API_SAFETY_TOAST_EVENT, type SafetyToastCode } from '../../lib/api-client'

type ToastEntry = {
  id: number
  message: string
}

type ToastContextValue = {
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
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const nextIdRef = useRef(0)
  const lastEmitRef = useRef<{ code: SafetyToastCode; at: number } | null>(null)

  const pushSafetyToast = useCallback(
    (code: SafetyToastCode) => {
      const now = Date.now()
      const previous = lastEmitRef.current

      if (previous && previous.code === code && now - previous.at < 350) {
        return
      }

      lastEmitRef.current = { code, at: now }

      const id = nextIdRef.current + 1
      nextIdRef.current = id
      const message = resolveSafetyToastMessage(code, (key) => t(key))

      setToasts((current) => [...current, { id, message }])

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id))
      }, 4500)
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
      pushSafetyToast,
    }),
    [pushSafetyToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-2" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            data-testid="safety-toast"
            className="pointer-events-auto rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 shadow-sm"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext) ?? { pushSafetyToast: () => undefined }
}
