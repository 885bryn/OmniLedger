import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'
import { useAdminScope } from '../admin-scope/admin-scope-context'
import { TargetUserChip, resolveTargetUserAttribution } from '../admin-scope/target-user-chip'
import { ConfirmationDialog } from '../ui/confirmation-dialog'
import { FollowUpModal } from './follow-up-modal'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'

type CompletionPayload = {
  id: string
  prompt_next_date: boolean
}

type CompleteEventRowActionProps = {
  eventId: string
  itemId?: string
}

export function CompleteEventRowAction({ eventId, itemId }: CompleteEventRowActionProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { isAdmin, mode, lensUserId, users } = useAdminScope()
  const queryClient = useQueryClient()
  const [showSuccess, setShowSuccess] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [failureText, setFailureText] = useState<string | null>(null)

  const attribution = resolveTargetUserAttribution({
    isAdmin,
    mode,
    lensUserId,
    users,
    actorUsername: session?.username,
    actorEmail: session?.email,
  })

  const completionMutation = useMutation({
    mutationFn: async () => apiRequest<CompletionPayload>(`/events/${eventId}/complete`, { method: 'PATCH' }),
    onMutate: () => {
      setFailureText(null)
    },
    onSuccess: async (payload) => {
      setShowSuccess(true)
      setShowFollowUp(payload.prompt_next_date)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        itemId ? queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }) : Promise.resolve(),
      ])
    },
    onError: (error) => {
      if (error instanceof ApiClientError) {
        setFailureText(`${t('events.completeAction.failed')} (${error.message})`)
        return
      }

      setFailureText(t('events.completeAction.failed'))
    },
  })

  return (
    <div className="flex items-center gap-2">
      {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} /> : null}
      <button
        type="button"
        disabled={completionMutation.isPending}
        onClick={() => {
          setConfirmOpen(true)
        }}
        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {completionMutation.isPending ? t('events.completeAction.pending') : t('events.completeAction.button')}
      </button>

      {showSuccess ? <p className="text-xs font-medium text-emerald-600">{t('events.completeAction.completed')}</p> : null}
      {completionMutation.isError ? <p className="text-xs font-medium text-destructive">{failureText ?? t('events.completeAction.failed')}</p> : null}

      <ConfirmationDialog
        open={confirmOpen}
        title={t('events.completeAction.confirmTitle')}
        description={
          <span className="space-y-2">
            <span className="block">{t('events.completeAction.confirm')}</span>
            {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} /> : null}
          </span>
        }
        confirmLabel={completionMutation.isPending ? t('events.completeAction.pending') : t('events.completeAction.button')}
        cancelLabel={t('events.completeAction.cancel')}
        pending={completionMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          completionMutation.mutate()
          setConfirmOpen(false)
        }}
      />

      <FollowUpModal
        open={showFollowUp}
        onNotNow={() => {
          setShowFollowUp(false)
        }}
        onScheduleNow={() => {
          setShowFollowUp(false)

          if (itemId) {
            navigate(`/items/${itemId}/edit`)
            return
          }

          navigate('/items')
        }}
      />
    </div>
  )
}
