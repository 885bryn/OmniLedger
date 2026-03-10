import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Pressable } from '@/components/ui/pressable'
import { useAuth } from '../../auth/auth-context'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'
import { useAdminScope } from '../admin-scope/admin-scope-context'
import { TargetUserChip, resolveTargetUserAttribution } from '../admin-scope/target-user-chip'
import { useToast } from '../ui/toast-provider'

type CompletionPayload = {
  id: string
  item_id: string
  type: string
  due_date: string
  amount: number | null
  status: string
  completed_at: string | null
}

type MarkPaidLedgerActionProps = {
  eventId: string
  itemId: string
  disabled?: boolean
  onSuccess: (payload: CompletionPayload) => void
}

export function MarkPaidLedgerAction({ eventId, itemId, disabled = false, onSuccess }: MarkPaidLedgerActionProps) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { isAdmin, mode, lensUserId, users } = useAdminScope()
  const { pushSafetyToast } = useToast()
  const queryClient = useQueryClient()
  const [inlineFailure, setInlineFailure] = useState<string | null>(null)
  const hasInvalidLensSelection = isAdmin && mode === 'owner' && (!lensUserId || !users.some((user) => user.id === lensUserId))

  const attribution = resolveTargetUserAttribution({
    isAdmin,
    mode,
    lensUserId,
    users,
    actorUsername: session?.username,
    actorEmail: session?.email,
  })

  const mutation = useMutation({
    mutationFn: async () => apiRequest<CompletionPayload>(`/events/${eventId}/complete`, { method: 'PATCH' }),
    onMutate: () => {
      setInlineFailure(null)
    },
    onSuccess: async (payload) => {
      setInlineFailure(null)
      onSuccess(payload)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
      ])
    },
  })

  function getFailureText(error: unknown) {
    if (error instanceof ApiClientError) {
      if (error.safetyToastCode === 'policy_denied') {
        return t('safety.policyDenied')
      }

      const issueText = error.issues[0]?.message
      return issueText ? `${t('events.markPaid.failed')} (${issueText})` : `${t('events.markPaid.failed')} (${error.message})`
    }

    return t('events.markPaid.failed')
  }

  const failureText = inlineFailure ?? (mutation.isError ? getFailureText(mutation.error) : null)
  const isDisabled = disabled || mutation.isPending
  const buttonLabel = mutation.isPending
    ? t('events.markPaid.pending')
    : failureText
      ? t('events.markPaid.retry')
      : t('events.markPaid.button')

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} /> : null}
      <Pressable>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDisabled}
          onClick={() => {
            if (mutation.isPending || disabled) {
              return
            }

            if (hasInvalidLensSelection) {
              setInlineFailure(t('safety.invalidLens'))
              pushSafetyToast('invalid_lens')
              mutation.reset()
              return
            }

            mutation.mutate()
          }}
        >
          {buttonLabel}
        </Button>
      </Pressable>
      {failureText ? <p className="text-xs font-medium text-destructive">{failureText}</p> : null}
    </div>
  )
}
