import { useEffect, useMemo, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pressable } from '@/components/ui/pressable'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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

type ReconcileLedgerActionProps = {
  eventId: string
  itemId: string
  projectedAmount: number | null
  projectedDate: string
  disabled?: boolean
  onSuccess: (payload: CompletionPayload) => void
  onOpenChange?: (open: boolean) => void
}

function formatAmountInput(value: number | null) {
  if (typeof value !== 'number' || Number.isFinite(value) === false) {
    return ''
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function formatProjectedAmount(value: number | null) {
  if (typeof value !== 'number' || Number.isFinite(value) === false) {
    return '--'
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatProjectedDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function getTodayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function useDesktopMode() {
  const query = '(min-width: 768px)'
  const getCurrent = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true
    }

    return window.matchMedia(query).matches
  }

  const [isDesktop, setIsDesktop] = useState(getCurrent)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const media = window.matchMedia(query)
    const sync = () => setIsDesktop(media.matches)
    sync()

    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return isDesktop
}

export function ReconcileLedgerAction({
  eventId,
  itemId,
  projectedAmount,
  projectedDate,
  disabled = false,
  onSuccess,
  onOpenChange,
}: ReconcileLedgerActionProps) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { isAdmin, mode, lensUserId, users } = useAdminScope()
  const { pushSafetyToast } = useToast()
  const queryClient = useQueryClient()
  const isDesktop = useDesktopMode()

  const copy = {
    button: t('events.reconcile.button', { defaultValue: 'Reconcile' }),
    pending: t('events.reconcile.pending', { defaultValue: 'Saving...' }),
    retry: t('events.reconcile.retry', { defaultValue: 'Retry' }),
    title: t('events.reconcile.title', { defaultValue: 'Reconcile payment' }),
    helper: t('events.reconcile.helper', { defaultValue: 'Review the projected values and adjust if needed before saving.' }),
    projectedReference: t('events.reconcile.projectedReference', { defaultValue: 'Projected: {{amount}} due {{date}}' }),
    amountLabel: t('events.reconcile.fields.amount', { defaultValue: 'Amount' }),
    dateLabel: t('events.reconcile.fields.date', { defaultValue: 'Paid date' }),
    amountInvalid: t('events.reconcile.errors.amountInvalid', { defaultValue: 'Enter a valid amount greater than zero.' }),
    failed: t('events.reconcile.failed', { defaultValue: 'Could not reconcile this row. Try again.' }),
    submit: t('events.reconcile.submit', { defaultValue: 'Save reconciliation' }),
    cancel: t('events.reconcile.cancel', { defaultValue: 'Cancel' }),
  }

  const [open, setOpen] = useState(false)
  const [draftAmount, setDraftAmount] = useState(() => formatAmountInput(projectedAmount))
  const [draftDate, setDraftDate] = useState(() => getTodayIsoDate())
  const [inlineFailure, setInlineFailure] = useState<string | null>(null)

  const hasInvalidLensSelection = isAdmin && mode === 'owner' && (!lensUserId || !users.some((user) => user.id === lensUserId))

  const attribution = useMemo(
    () => resolveTargetUserAttribution({
      isAdmin,
      mode,
      lensUserId,
      users,
      actorUsername: session?.username,
      actorEmail: session?.email,
    }),
    [isAdmin, lensUserId, mode, session?.email, session?.username, users],
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const amountValue = draftAmount.trim()
      const dateValue = draftDate.trim()
      const body: { actual_amount?: number; actual_date?: string } = {}

      if (amountValue) {
        const parsedAmount = Number(amountValue)
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
          throw new Error(copy.amountInvalid)
        }

        body.actual_amount = parsedAmount
      }

      if (dateValue) {
        body.actual_date = dateValue
      }

      return apiRequest<CompletionPayload>(`/events/${eventId}/complete`, {
        method: 'PATCH',
        body,
      })
    },
    onMutate: () => {
      setInlineFailure(null)
    },
    onSuccess: async (payload) => {
      setInlineFailure(null)
      onSuccess(payload)
      setOpen(false)
      onOpenChange?.(false)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
      ])
    },
    onError: (error) => {
      if (error instanceof Error && !(error instanceof ApiClientError)) {
        setInlineFailure(error.message)
        return
      }

      if (error instanceof ApiClientError) {
        if (error.safetyToastCode === 'policy_denied') {
          setInlineFailure(t('safety.policyDenied'))
          return
        }

        const issueText = error.issues[0]?.message
        setInlineFailure(issueText ? `${copy.failed} (${issueText})` : `${copy.failed} (${error.message})`)
        return
      }

      setInlineFailure(copy.failed)
    },
  })

  const triggerDisabled = disabled || mutation.isPending || open
  const triggerLabel = mutation.isPending
    ? copy.pending
    : inlineFailure
      ? copy.retry
      : copy.button

  const projectedReference = t('events.reconcile.projectedReference', {
    amount: formatProjectedAmount(projectedAmount),
    date: formatProjectedDate(projectedDate),
    defaultValue: copy.projectedReference,
  })

  function openSurface(nextOpen: boolean) {
    if (nextOpen) {
      setDraftAmount(formatAmountInput(projectedAmount))
      setDraftDate(getTodayIsoDate())
      setInlineFailure(null)
    }

    setOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  function handleSave() {
    if (disabled || mutation.isPending) {
      return
    }

    if (hasInvalidLensSelection) {
      setInlineFailure(t('safety.invalidLens'))
      pushSafetyToast('invalid_lens')
      return
    }

    mutation.mutate()
  }

  const content = (
    <div className="space-y-4 text-sm">
      <p className="text-sm text-muted-foreground">{copy.helper}</p>
      <p className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs font-medium text-foreground">
        {projectedReference}
      </p>

      <div className="space-y-2">
        <Label htmlFor={`reconcile-amount-${eventId}`} className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {copy.amountLabel}
        </Label>
        <Input
          id={`reconcile-amount-${eventId}`}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={draftAmount}
          disabled={mutation.isPending}
          onChange={(event) => setDraftAmount(event.target.value)}
          className="h-10 w-full bg-background/90 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`reconcile-date-${eventId}`} className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {copy.dateLabel}
        </Label>
        <Input
          id={`reconcile-date-${eventId}`}
          type="date"
          value={draftDate}
          disabled={mutation.isPending}
          onChange={(event) => setDraftDate(event.target.value)}
          className="h-10 w-full bg-background/90 px-3 py-2 text-sm"
        />
      </div>

      {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} /> : null}

      {inlineFailure ? <p className="text-xs font-medium text-destructive">{inlineFailure}</p> : null}
    </div>
  )

  const actionFooter = (
    <div data-testid="reconcile-action-footer" className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border/70 bg-background/95 px-4 py-3">
      <Pressable whileTap={mutation.isPending ? { scale: 1 } : undefined}>
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => {
            openSurface(false)
          }}
        >
          {copy.cancel}
        </Button>
      </Pressable>
      <Pressable whileTap={mutation.isPending ? { scale: 1 } : undefined}>
        <Button type="button" disabled={mutation.isPending} onClick={handleSave}>
          {mutation.isPending ? copy.pending : inlineFailure ? copy.retry : copy.submit}
        </Button>
      </Pressable>
    </div>
  )

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} /> : null}
      <Pressable>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={triggerDisabled}
          onClick={() => {
            openSurface(true)
          }}
        >
          {triggerLabel}
        </Button>
      </Pressable>

      {isDesktop ? (
        <DialogPrimitive.Root open={open} onOpenChange={openSurface}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-[95] bg-black/20" />
            <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-[96] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-surface-strong)]">
              <div className="border-b border-border/70 px-4 py-3">
                <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                  {copy.title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  {copy.helper}
                </DialogPrimitive.Description>
              </div>
              <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{content}</div>
              {actionFooter}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      ) : (
        <Sheet open={open} onOpenChange={openSurface}>
          <SheetContent
            data-testid="reconcile-sheet-content"
            side="bottom"
            showCloseButton={false}
            className="max-h-[85vh] overflow-hidden rounded-t-2xl border-t border-border bg-card px-0"
          >
            <SheetHeader className="border-b border-border/70 px-4 py-3">
              <SheetTitle>{copy.title}</SheetTitle>
              <SheetDescription>{copy.helper}</SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 py-4">{content}</div>
            <SheetFooter className="p-0">{actionFooter}</SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
