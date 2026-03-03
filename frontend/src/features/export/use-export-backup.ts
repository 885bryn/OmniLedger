import { useMutation } from '@tanstack/react-query'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

const DEFAULT_DOWNLOAD_FILENAME = 'hact-backup.xlsx'

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
  const mutation = useMutation<void, Error>({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/exports/backup.xlsx`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Export failed. Retry after checking your connection and session.')
      }

      const blob = await response.blob()
      const filename = parseFilename(response.headers.get('content-disposition'))
      triggerBrowserDownload(blob, filename)
    },
  })

  return {
    triggerExport: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }
}
