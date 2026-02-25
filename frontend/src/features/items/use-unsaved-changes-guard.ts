import { useBeforeUnload, useBlocker } from 'react-router-dom'

export function useUnsavedChangesGuard(isDirty: boolean, message: string) {
  useBeforeUnload((event) => {
    if (!isDirty) {
      return
    }

    event.preventDefault()
    event.returnValue = message
  })

  useBlocker(({ currentLocation, nextLocation }) => {
    if (!isDirty) {
      return false
    }

    if (currentLocation.pathname === nextLocation.pathname) {
      return false
    }

    return !window.confirm(message)
  })
}
