import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'
import { useAdminScope } from '../admin-scope/admin-scope-context'
import { TargetUserChip, resolveTargetUserAttribution } from '../admin-scope/target-user-chip'
import { ConfirmationDialog } from '../ui/confirmation-dialog'
import { useToast } from '../ui/toast-provider'
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
  eventStatus?: string
}

export function CompleteEventRowAction({ eventId, itemId, eventStatus }: CompleteEventRowActionProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { isAdmin, mode, lensUserId, users } = useAdminScope()
  const { pushSafetyToast } = useToast()
  const queryClient = useQueryClient()
  const [showSuccess, setShowSuccess] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [failureText, setFailureText] = useState<string | null>(null)
  const isCompleted = eventStatus === 'Completed'
  const hasInvalidLensSelection = isAdmin && mode === 'owner' && (!lensUserId || !users.some((user) => user.id === lensUserId))

  function blockWhenLensInvalid() {
    if (!hasInvalidLensSelection) {
      return false
    }

    const message = t('safety.invalidLens')
    setFailureText(message)
    pushSafetyToast('invalid_lens')
    return true
  }

  const attribution = resolveTargetUserAttribution({
    isAdmin,
    mode,
    lensUserId,
    users,
    actorUsername: session?.username,
    actorEmail: session?.email,
  })

  const completionMutation = useMutation({
    mutationFn: async () =>
      isCompleted
        ? apiRequest<CompletionPayload>(`/events/${eventId}/undo-complete`, { method: 'PATCH' })
        : apiRequest<CompletionPayload>(`/events/${eventId}/complete`, { method: 'PATCH' }),
    onMutate: () => {
      setFailureText(null)
      setShowSuccess(false)
    },
    onSuccess: async (payload) => {
      setShowSuccess(true)
      setShowFollowUp(!isCompleted && payload.prompt_next_date)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        itemId ? queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }) : Promise.resolve(),
      ])
    },
    onError: (error) => {
      if (error instanceof ApiClientError) {
        if (error.safetyToastCode === 'policy_denied') {
          setFailureText(t('safety.policyDenied'))
          return
        }

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
          if (blockWhenLensInvalid()) {
            return
          }

          setConfirmOpen(true)
        }}
        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {completionMutation.isPending
          ? isCompleted
            ? t('events.completeAction.undoPending')
            : t('events.completeAction.pending')
          : isCompleted
            ? t('events.completeAction.undoButton')
            : t('events.completeAction.button')}
      </button>

      {showSuccess ? <p className="text-xs font-medium text-emerald-600">{t('events.completeAction.completed')}</p> : null}
      {failureText ? <p className="text-xs font-medium text-destructive">{failureText}</p> : null}

      <ConfirmationDialog
        open={confirmOpen}
        title={isCompleted ? t('events.completeAction.undoConfirmTitle') : t('events.completeAction.confirmTitle')}
        description={
          <span className="space-y-2">
            <span className="block">{isCompleted ? t('events.completeAction.undoConfirm') : t('events.completeAction.confirm')}</span>
            {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} /> : null}
          </span>
        }
        confirmLabel={
          completionMutation.isPending
            ? isCompleted
              ? t('events.completeAction.undoPending')
              : t('events.completeAction.pending')
            : isCompleted
              ? t('events.completeAction.undoButton')
              : t('events.completeAction.button')
        }
        cancelLabel={t('events.completeAction.cancel')}
        pending={completionMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (blockWhenLensInvalid()) {
            setConfirmOpen(false)
            return
          }

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
