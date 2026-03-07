import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../../auth/auth-context'
import { useAdminScope } from '../admin-scope/admin-scope-context'
import { TargetUserChip, resolveTargetUserAttribution } from '../admin-scope/target-user-chip'
import { ConfirmationDialog } from '../ui/confirmation-dialog'
import { useToast } from '../ui/toast-provider'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'

type EditEventRowActionProps = {
  eventId: string
  itemId?: string
  eventStatus?: string
  dueDate: string
  amount: number | null
  isProjected: boolean
}

type EventUpdateResponse = {
  id: string
}

function toDateInputValue(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toISOString().slice(0, 10)
}

export function EditEventRowAction({ eventId, itemId, eventStatus, dueDate, amount, isProjected }: EditEventRowActionProps) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { isAdmin, mode, lensUserId, users } = useAdminScope()
  const { pushSafetyToast } = useToast()
  const queryClient = useQueryClient()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [draftDueDate, setDraftDueDate] = useState(() => toDateInputValue(dueDate))
  const [draftAmount, setDraftAmount] = useState(() => (typeof amount === 'number' ? String(amount) : ''))
  const [failureText, setFailureText] = useState<string | null>(null)

  const isEditable = eventStatus !== 'Completed'
  const hasInvalidLensSelection = isAdmin && mode === 'owner' && (!lensUserId || !users.some((user) => user.id === lensUserId))

  const attribution = resolveTargetUserAttribution({
    isAdmin,
    mode,
    lensUserId,
    users,
    actorUsername: session?.username,
    actorEmail: session?.email,
  })

  const originalDueDate = useMemo(() => toDateInputValue(dueDate), [dueDate])
  const originalAmount = useMemo(() => (typeof amount === 'number' ? String(amount) : ''), [amount])
  const dueChanged = draftDueDate !== originalDueDate
  const amountChanged = draftAmount.trim() !== originalAmount
  const showChangeSummary = dueChanged && amountChanged

  function blockWhenLensInvalid() {
    if (!hasInvalidLensSelection) {
      return false
    }

    const message = t('safety.invalidLens')
    setFailureText(message)
    pushSafetyToast('invalid_lens')
    return true
  }

  const editMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {}
      if (dueChanged) {
        payload.due_date = draftDueDate
      }
      if (amountChanged) {
        payload.amount = Number(draftAmount)
      }

      if (Object.keys(payload).length === 0) {
        throw new Error('no_changes')
      }

      return apiRequest<EventUpdateResponse>(`/events/${eventId}`, {
        method: 'PATCH',
        body: payload,
      })
    },
    onMutate: () => {
      setFailureText(null)
    },
    onSuccess: async () => {
      setConfirmOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        itemId ? queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }) : Promise.resolve(),
      ])
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'no_changes') {
        setFailureText(t('events.editAction.noChanges'))
        return
      }

      if (error instanceof ApiClientError) {
        if (error.safetyToastCode === 'policy_denied') {
          setFailureText(t('safety.policyDenied'))
          return
        }

        const issueText = error.issues[0]?.message
        if (issueText) {
          setFailureText(`${t('events.editAction.failed')} (${issueText})`)
          return
        }

        setFailureText(`${t('events.editAction.failed')} (${error.message})`)
        return
      }

      setFailureText(t('events.editAction.failed'))
    },
  })

  if (!isEditable) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          if (blockWhenLensInvalid()) {
            return
          }

          setDraftDueDate(originalDueDate)
          setDraftAmount(originalAmount)
          setConfirmOpen(true)
        }}
        disabled={editMutation.isPending}
      >
        {editMutation.isPending ? t('events.editAction.pending') : t('events.editAction.button')}
      </Button>

      {failureText ? <p className="text-xs font-medium text-destructive">{failureText}</p> : null}

      <ConfirmationDialog
        open={confirmOpen}
        title={t('events.editAction.confirmTitle')}
        description={
            <span className="space-y-3">
              <span className="block text-xs text-muted-foreground">{isProjected ? t('events.editAction.projectedConfirm') : t('events.editAction.persistedConfirm')}</span>
              <div className="space-y-2">
                <Label htmlFor={`event-${eventId}-date`} className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t('events.editAction.fields.date')}
                </Label>
                <Input
                  id={`event-${eventId}-date`}
                  type="date"
                  value={draftDueDate}
                  onChange={(event) => setDraftDueDate(event.target.value)}
                  className="h-10 w-full bg-background/90 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`event-${eventId}-amount`} className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t('events.editAction.fields.amount')}
                </Label>
                <Input
                  id={`event-${eventId}-amount`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftAmount}
                  onChange={(event) => setDraftAmount(event.target.value)}
                  className="h-10 w-full bg-background/90 px-3 py-2 text-sm"
                />
              </div>
            {showChangeSummary ? (
              <span className="block rounded-lg border border-border bg-muted/40 px-2 py-2 text-xs text-foreground">
                {t('events.editAction.changeSummaryDate', { oldValue: originalDueDate, newValue: draftDueDate })}
                <br />
                {t('events.editAction.changeSummaryAmount', { oldValue: originalAmount, newValue: draftAmount.trim() })}
              </span>
            ) : null}
            {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} /> : null}
          </span>
        }
        confirmLabel={editMutation.isPending ? t('events.editAction.pending') : isProjected ? t('events.editAction.saveException') : t('events.editAction.save')}
        cancelLabel={t('events.editAction.cancel')}
        pending={editMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (blockWhenLensInvalid()) {
            setConfirmOpen(false)
            return
          }

          editMutation.mutate()
        }}
      />
    </div>
  )
}
