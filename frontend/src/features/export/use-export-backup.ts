import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { API_BASE_URL } from '../../lib/api-client'

const DEFAULT_DOWNLOAD_FILENAME = 'hact-backup.xlsx'
const LONG_RUNNING_THRESHOLD_MS = 4000

export type ExportFeedbackPhase = 'idle' | 'pending' | 'success' | 'error'
export type ExportErrorKind = 'network' | 'session' | 'server'

class ExportRequestError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ExportRequestError'
    this.status = status
  }
}

function classifyExportError(error: unknown): ExportErrorKind {
  if (error instanceof ExportRequestError) {
    if (error.status === 401) {
      return 'session'
    }

    if (error.status >= 500) {
      return 'server'
    }

    return 'network'
  }

  return 'network'
}

function parseFilename(contentDisposition: string | null) {
  if (!contentDisposition) {
    return DEFAULT_DOWNLOAD_FILENAME
  }

  const utf8FilenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8FilenameMatch?.[1]) {
    try {
      return decodeURIComponent(utf8FilenameMatch[1].trim().replace(/(^")|("$)/g, ''))
    } catch {
      return utf8FilenameMatch[1].trim().replace(/(^")|("$)/g, '')
    }
  }

  const filenameMatch = contentDisposition.match(/filename=("?)([^";]+)\1/i)
  if (!filenameMatch?.[2]) {
    return DEFAULT_DOWNLOAD_FILENAME
  }

  return filenameMatch[2].trim()
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

export function useExportBackup() {
  const [attemptCount, setAttemptCount] = useState(0)
  const [errorKind, setErrorKind] = useState<ExportErrorKind | null>(null)
  const [isLongRunning, setIsLongRunning] = useState(false)

  const mutation = useMutation<void, Error>({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/exports/backup.xlsx`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new ExportRequestError(401, 'Export failed because the session expired. Sign in again and retry.')
        }

        if (response.status >= 500) {
          throw new ExportRequestError(response.status, 'Export failed due to a server error. Retry in a moment.')
        }

        throw new ExportRequestError(response.status, 'Export failed. Retry after checking your connection and session.')
      }

      const blob = await response.blob()
      const filename = parseFilename(response.headers.get('content-disposition'))
      triggerBrowserDownload(blob, filename)
    },
  })

  useEffect(() => {
    if (!mutation.isPending) {
      setIsLongRunning(false)
      return undefined
    }

    const timer = window.setTimeout(() => {
      setIsLongRunning(true)
    }, LONG_RUNNING_THRESHOLD_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [mutation.isPending])

  const triggerExport = useCallback(async () => {
    mutation.reset()
    setErrorKind(null)
    setIsLongRunning(false)

    try {
      await mutation.mutateAsync()
      setAttemptCount(0)
    } catch (error) {
      setAttemptCount((current) => current + 1)
      setErrorKind(classifyExportError(error))
      throw error
    }
  }, [mutation])

  const reset = useCallback(() => {
    mutation.reset()
    setAttemptCount(0)
    setErrorKind(null)
    setIsLongRunning(false)
  }, [mutation])

  const phase = useMemo<ExportFeedbackPhase>(() => {
    if (mutation.isPending) {
      return 'pending'
    }

    if (mutation.isSuccess) {
      return 'success'
    }

    if (mutation.isError) {
      return 'error'
    }

    return 'idle'
  }, [mutation.isError, mutation.isPending, mutation.isSuccess])

  return {
    triggerExport,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset,
    phase,
    errorKind,
    attemptCount,
    isLongRunning,
  }
}
