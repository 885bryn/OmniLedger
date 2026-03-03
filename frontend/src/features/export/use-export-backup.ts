import { useMutation } from '@tanstack/react-query'
import { apiRequest, type ApiClientError } from '../../lib/api-client'

type ExportBackupResponse = {
  export?: {
    format?: string
  }
}

export function useExportBackup() {
  const mutation = useMutation<ExportBackupResponse, ApiClientError>({
    mutationFn: () =>
      apiRequest<ExportBackupResponse>('/exports/backup.xlsx', {
        method: 'GET',
      }),
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
