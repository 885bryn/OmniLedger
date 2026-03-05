import { useMemo, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

export function useUnsavedChangesGuard(isDirty: boolean) {
  const allowNextNavigationRef = useRef(false)

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowNextNavigationRef.current) {
      allowNextNavigationRef.current = false
      return false
    }

    if (!isDirty) {
      return false
    }

    if (currentLocation.pathname === nextLocation.pathname) {
      return false
    }

    return true
  })

  return useMemo(
    () => ({
      open: blocker.state === 'blocked',
      proceed: () => {
        blocker.proceed?.()
      },
      stay: () => {
        blocker.reset?.()
      },
      allowNextNavigation: () => {
        allowNextNavigationRef.current = true
      },
    }),
    [blocker],
  )
}
