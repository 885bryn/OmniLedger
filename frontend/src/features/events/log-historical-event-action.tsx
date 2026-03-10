import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pressable } from '@/components/ui/pressable'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '../../auth/auth-context'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { queryKeys, type LensScope } from '../../lib/query-keys'
import { useAdminScope } from '../admin-scope/admin-scope-context'
import { TargetUserChip, resolveTargetUserAttribution } from '../admin-scope/target-user-chip'
import { ConfirmationDialog } from '../ui/confirmation-dialog'
import { useToast } from '../ui/toast-provider'

type ManualOverrideResponse = {
  id: string
  warnings?: Array<{
    field?: string
    message?: string
  }>
}

type LogHistoricalEventActionProps = {
  itemId: string
  defaultDueDate: string
  defaultAmount: number | null
  lensScope: LensScope
  onSuccess?: () => void
}

function formatAmountInput(value: number | null) {
  if (typeof value !== 'number' || Number.isFinite(value) === false) {
    return ''
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function LogHistoricalEventAction({ itemId, defaultDueDate, defaultAmount, lensScope, onSuccess }: LogHistoricalEventActionProps) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { isAdmin, mode, lensUserId, users } = useAdminScope()
  const { push, pushSafetyToast } = useToast()
  const queryClient = useQueryClient()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [draftDueDate, setDraftDueDate] = useState(defaultDueDate)
  const [draftAmount, setDraftAmount] = useState(() => formatAmountInput(defaultAmount))
  const [draftNote, setDraftNote] = useState('')
  const [failureText, setFailureText] = useState<string | null>(null)
  const [warningTexts, setWarningTexts] = useState<string[]>([])
  const [savedWithWarnings, setSavedWithWarnings] = useState(false)

  const showScopedAttribution = isAdmin && mode === 'owner'
  const hasInvalidLensSelection = showScopedAttribution && (!lensUserId || !users.some((user) => user.id === lensUserId))

  const attribution = useMemo(
    () => (showScopedAttribution
      ? resolveTargetUserAttribution({
          isAdmin,
          mode,
          lensUserId,
          users,
          actorUsername: session?.username,
          actorEmail: session?.email,
        })
      : null),
    [isAdmin, lensUserId, mode, session?.email, session?.username, showScopedAttribution, users],
  )

  function resetDraft() {
    setDraftDueDate(defaultDueDate)
    setDraftAmount(formatAmountInput(defaultAmount))
    setDraftNote('')
    setFailureText(null)
    setWarningTexts([])
    setSavedWithWarnings(false)
  }

  function validateDraft() {
    if (!draftDueDate) {
      return t('items.detail.historicalAction.errors.dateRequired')
    }

    const amount = Number(draftAmount)
    if (!draftAmount.trim() || Number.isFinite(amount) === false || amount <= 0) {
      return t('items.detail.historicalAction.errors.amountRequired')
    }

    return null
  }

  const historicalMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateDraft()
      if (validationError) {
        throw new Error(validationError)
      }

      return apiRequest<ManualOverrideResponse>('/events/manual-override', {
        method: 'POST',
        body: {
          item_id: itemId,
          due_date: draftDueDate,
          amount: Number(draftAmount),
          note: draftNote.trim() ? draftNote.trim() : undefined,
        },
      })
    },
    onMutate: () => {
      setFailureText(null)
      setWarningTexts([])
      setSavedWithWarnings(false)
    },
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId, lensScope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.itemLedger(itemId, { status: 'all', ...(lensScope.mode === 'owner' && lensScope.lensUserId ? { scope_mode: 'owner', lens_user_id: lensScope.lensUserId } : { scope_mode: 'all' }) }) }),
      ])

      push({
        message: t('items.detail.historicalAction.success'),
        tone: 'success',
        dedupeKey: `historical-entry:${itemId}`,
      })

      onSuccess?.()

      const warnings = (response.warnings ?? [])
        .map((warning) => warning.message?.trim())
        .filter((warning): warning is string => Boolean(warning))

      if (warnings.length > 0) {
        setWarningTexts(warnings)
        setSavedWithWarnings(true)
        return
      }

      setConfirmOpen(false)
    },
    onError: (error) => {
      if (error instanceof Error && !(error instanceof ApiClientError)) {
        setFailureText(error.message)
        return
      }

      if (error instanceof ApiClientError) {
        if (error.safetyToastCode === 'policy_denied') {
          setFailureText(t('safety.policyDenied'))
          return
        }

        const issueText = error.issues[0]?.message
        if (issueText) {
          setFailureText(issueText)
          return
        }

        setFailureText(error.message)
        return
      }

      setFailureText(t('items.detail.historicalAction.errors.generic'))
    },
  })

  return (
    <div className="flex items-center gap-2">
      <Pressable>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            resetDraft()
            setConfirmOpen(true)
          }}
          disabled={historicalMutation.isPending}
        >
          {historicalMutation.isPending ? t('items.detail.historicalAction.pending') : t('items.detail.historicalAction.button')}
        </Button>
      </Pressable>

      <ConfirmationDialog
        open={confirmOpen}
        title={t('items.detail.historicalAction.title')}
        description={
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{t('items.detail.historicalAction.helper')}</p>
              <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-900">
                {t('items.detail.historicalAction.warning')}
              </p>
            </div>

            {savedWithWarnings ? (
              <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-900">
                <p>{t('items.detail.historicalAction.warningSaved')}</p>
                {warningTexts.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor={`historical-event-date-${itemId}`} className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t('items.detail.historicalAction.fields.date')}
              </Label>
              <Input
                id={`historical-event-date-${itemId}`}
                type="date"
                value={draftDueDate}
                disabled={historicalMutation.isPending || savedWithWarnings}
                onChange={(event) => setDraftDueDate(event.target.value)}
                className="h-10 w-full bg-background/90 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`historical-event-amount-${itemId}`} className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t('items.detail.historicalAction.fields.amount')}
              </Label>
              <Input
                id={`historical-event-amount-${itemId}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={draftAmount}
                disabled={historicalMutation.isPending || savedWithWarnings}
                onChange={(event) => setDraftAmount(event.target.value)}
                className="h-10 w-full bg-background/90 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`historical-event-note-${itemId}`} className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t('items.detail.historicalAction.fields.note')}
              </Label>
              <Textarea
                id={`historical-event-note-${itemId}`}
                rows={3}
                value={draftNote}
                disabled={historicalMutation.isPending || savedWithWarnings}
                onChange={(event) => setDraftNote(event.target.value)}
                className="min-h-24 bg-background/90 px-3 py-2 text-sm"
                placeholder={t('items.detail.historicalAction.fields.notePlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('items.detail.historicalAction.noteOptional')}</p>
            </div>

            {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} /> : null}

            {failureText ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{failureText}</p> : null}
          </div>
        }
        confirmLabel={savedWithWarnings
          ? t('items.detail.historicalAction.viewHistory')
          : historicalMutation.isPending
            ? t('items.detail.historicalAction.pending')
            : t('items.detail.historicalAction.save')}
        cancelLabel={t('items.detail.historicalAction.cancel')}
        pending={historicalMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (savedWithWarnings) {
            setConfirmOpen(false)
            return
          }

          if (hasInvalidLensSelection) {
            setFailureText(t('safety.invalidLens'))
            pushSafetyToast('invalid_lens')
            return
          }

          historicalMutation.mutate()
        }}
      />
    </div>
  )
}
