import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '../../auth/auth-context'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { TargetUserChip, resolveTargetUserAttribution } from '../../features/admin-scope/target-user-chip'
import { ConfirmationDialog } from '../../features/ui/confirmation-dialog'
import { useToast } from '../../features/ui/toast-provider'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { getItemDisplayName, isHiddenAttributeKey } from '../../lib/item-display'
import { useUnsavedChangesGuard } from '../../features/items/use-unsaved-changes-guard'
import { queryKeys } from '../../lib/query-keys'

type ItemRow = {
  id: string
  item_type: string
  type?: string | null
  frequency?: string | null
  attributes: Record<string, unknown>
}

type FinancialSubtype = 'Commitment' | 'Income'
type FinancialFrequency = 'one_time' | 'weekly' | 'monthly' | 'yearly'

const FINANCIAL_FREQUENCY_OPTIONS: FinancialFrequency[] = ['one_time', 'weekly', 'monthly', 'yearly']

function resolveFinancialSubtype(item: ItemRow): FinancialSubtype {
  if (item.type === 'Income') {
    return 'Income'
  }

  if (item.type === 'Commitment') {
    return 'Commitment'
  }

  if (item.attributes?.financialSubtype === 'Income') {
    return 'Income'
  }

  return 'Commitment'
}

function resolveFinancialFrequency(item: ItemRow): FinancialFrequency {
  const explicit = item.frequency
  if (explicit === 'one_time' || explicit === 'weekly' || explicit === 'monthly' || explicit === 'yearly') {
    return explicit
  }

  const fromAttributes = item.attributes?.billingCycle
  if (fromAttributes === 'one_time' || fromAttributes === 'weekly' || fromAttributes === 'monthly' || fromAttributes === 'yearly') {
    return fromAttributes
  }

  return 'monthly'
}

type ItemsResponse = {
  items: ItemRow[]
}

function isEditablePrimitive(value: unknown) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}

function convertForSave(current: Record<string, unknown>, initial: Record<string, unknown>) {
  const output: Record<string, unknown> = { ...current }

  for (const [key, initialValue] of Object.entries(initial)) {
    if (typeof initialValue !== 'number') {
      continue
    }

    const raw = output[key]
    const parsed = typeof raw === 'string' ? Number(raw.replace(/[$,\s]/g, '')) : Number(raw)
    output[key] = Number.isFinite(parsed) ? parsed : initialValue
  }

  return output
}

function normalizeCurrencyInput(value: string) {
  const sanitized = value.replace(/[^0-9.]/g, '')
  if (!sanitized) {
    return ''
  }

  const [wholePartRaw, ...decimalParts] = sanitized.split('.')
  const wholePart = wholePartRaw.replace(/^0+(?=\d)/, '') || '0'
  const decimals = decimalParts.join('').slice(0, 2)

  return decimals.length > 0 ? `${wholePart}.${decimals}` : wholePart
}

function formatCurrencyInput(value: string | number) {
  const normalized = normalizeCurrencyInput(String(value))
  if (!normalized) {
    return ''
  }

  const [wholePart, decimals = ''] = normalized.split('.')
  const groupedWhole = Number(wholePart).toLocaleString()

  if (decimals.length > 0) {
    return `$${groupedWhole}.${decimals}`
  }

  return `$${groupedWhole}`
}

function isMoneyField(key: string) {
  const normalized = key.toLowerCase()
  return [
    'amount',
    'estimatedvalue',
    'remainingbalance',
    'originalprincipal',
    'monthlyrent',
    'collectedtotal',
    'trackingstartingremainingbalance',
    'trackingstartingcollectedtotal',
    'trackingcompletedtotal',
    'lastpaymentamount',
    'lastcollectedamount',
  ].includes(normalized)
}

const editFieldLabelClassName = 'text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground'
const editFieldHintClassName = 'text-xs leading-relaxed text-muted-foreground'

function EditFieldShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`.trim()}>{children}</div>
}

export function ItemEditPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { isAdmin, mode, lensUserId, users } = useAdminScope()
  const { pushSafetyToast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams<{ itemId: string }>()
  const itemId = params.itemId || ''

  const [initialAttributes, setInitialAttributes] = useState<Record<string, unknown>>({})
  const [draftAttributes, setDraftAttributes] = useState<Record<string, unknown>>({})
  const [showTechnical, setShowTechnical] = useState(false)
  const [initialFinancialSubtype, setInitialFinancialSubtype] = useState<FinancialSubtype>('Commitment')
  const [draftFinancialSubtype, setDraftFinancialSubtype] = useState<FinancialSubtype>('Commitment')
  const [initialFinancialFrequency, setInitialFinancialFrequency] = useState<FinancialFrequency>('monthly')
  const [draftFinancialFrequency, setDraftFinancialFrequency] = useState<FinancialFrequency>('monthly')
  const [newFieldKey, setNewFieldKey] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const hasInvalidLensSelection = isAdmin && mode === 'owner' && (!lensUserId || !users.some((user) => user.id === lensUserId))

  function blockWhenLensInvalid() {
    if (!hasInvalidLensSelection) {
      return false
    }

    const message = t('safety.invalidLens')
    setFieldError(message)
    pushSafetyToast('invalid_lens')
    return true
  }

  const itemQuery = useQuery({
    queryKey: queryKeys.items.list({ scope: 'edit', itemId }),
    enabled: Boolean(itemId),
    queryFn: async () => {
      const response = await apiRequest<ItemsResponse>('/items?include_deleted=true')
      return response.items.find((item) => item.id === itemId) ?? null
    },
  })

  const hasUnsavedChanges = useMemo(
    () =>
      JSON.stringify(draftAttributes) !== JSON.stringify(initialAttributes) ||
      draftFinancialSubtype !== initialFinancialSubtype ||
      draftFinancialFrequency !== initialFinancialFrequency,
    [draftAttributes, draftFinancialFrequency, draftFinancialSubtype, initialAttributes, initialFinancialFrequency, initialFinancialSubtype],
  )

  const attribution = resolveTargetUserAttribution({
    isAdmin,
    mode,
    lensUserId,
    users,
    actorUsername: session?.username,
    actorEmail: session?.email,
  })

  const unsavedGuard = useUnsavedChangesGuard(hasUnsavedChanges)

  useEffect(() => {
    if (!itemQuery.data) {
      return
    }

    setInitialAttributes(itemQuery.data.attributes)
    setDraftAttributes(itemQuery.data.attributes)
    const subtype = resolveFinancialSubtype(itemQuery.data)
    setInitialFinancialSubtype(subtype)
    setDraftFinancialSubtype(subtype)
    const frequency = resolveFinancialFrequency(itemQuery.data)
    setInitialFinancialFrequency(frequency)
    setDraftFinancialFrequency(frequency)
  }, [itemQuery.data])

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = convertForSave(draftAttributes, initialAttributes)

      return apiRequest<ItemRow>(`/items/${itemId}`, {
        method: 'PATCH',
        body: {
          attributes: payload,
          ...(itemQuery.data?.item_type === 'FinancialItem'
            ? {
                type: draftFinancialSubtype,
                frequency: draftFinancialFrequency,
              }
            : {}),
        },
      })
    },
    onMutate: () => {
      setFieldError(null)
    },
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])

      setInitialAttributes(updated.attributes)
      setDraftAttributes(updated.attributes)
      if (updated.item_type === 'FinancialItem') {
        const subtype = resolveFinancialSubtype(updated)
        setInitialFinancialSubtype(subtype)
        setDraftFinancialSubtype(subtype)
        const frequency = resolveFinancialFrequency(updated)
        setInitialFinancialFrequency(frequency)
        setDraftFinancialFrequency(frequency)
      }
      unsavedGuard.allowNextNavigation()
      navigate(`/items/${itemId}`)
    },
    onError: (error) => {
      if (error instanceof ApiClientError) {
        if (error.safetyToastCode === 'policy_denied') {
          setFieldError(t('safety.policyDenied'))
          return
        }

        setFieldError(`${t('items.edit.saveError')} (${error.message})`)
        return
      }

      setFieldError(t('items.edit.saveError'))
    },
  })

  const editableEntries = useMemo(
    () =>
      Object.entries(draftAttributes)
        .filter(([key, value]) => {
          if (itemQuery.data?.item_type === 'FinancialItem' && (key === 'financialSubtype' || key === 'billingCycle')) {
            return false
          }

          if (itemQuery.data?.item_type === 'FinancialItem' && key === 'nextPaymentAmount') {
            return false
          }

          return !isHiddenAttributeKey(key) && isEditablePrimitive(value)
        })
        .sort(([a], [b]) => a.localeCompare(b)),
    [draftAttributes, itemQuery.data?.item_type],
  )

  const technicalSnapshot = useMemo(() => {
    const sanitized = Object.entries(draftAttributes).reduce<Record<string, unknown>>((output, [key, value]) => {
      if (isHiddenAttributeKey(key)) {
        return output
      }

      output[key] = value
      return output
    }, {})

    return JSON.stringify(sanitized, null, 2)
  }, [draftAttributes])

  const errorText = useMemo(() => {
    if (fieldError) {
      return fieldError
    }

    if (updateMutation.error instanceof ApiClientError) {
      return updateMutation.error.message
    }

    if (updateMutation.isError) {
      return t('items.edit.saveError')
    }

    return null
  }, [fieldError, t, updateMutation.error, updateMutation.isError])

  function addCustomField() {
    const key = newFieldKey.trim()
    if (!key) {
      setFieldError(t('items.edit.customFieldNameRequired'))
      return
    }

    if (Object.prototype.hasOwnProperty.call(draftAttributes, key)) {
      setFieldError(t('items.edit.customFieldExists'))
      return
    }

    setDraftAttributes((current) => ({ ...current, [key]: newFieldValue }))
    setNewFieldKey('')
    setNewFieldValue('')
    setFieldError(null)
  }

  if (itemQuery.isLoading) {
    return (
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm shadow-black/5 dark:shadow-none" aria-label="Loading item edit">
        <div className="h-20 animate-pulse rounded-xl bg-muted/80" />
      </section>
    )
  }

  if (itemQuery.isError || !itemQuery.data) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        {t('items.edit.loadError')}
      </section>
    )
  }

  const currentItem = itemQuery.data

  return (
    <section className="space-y-6">
      <Card className="animate-fade-up border border-border bg-card/95 shadow-sm shadow-black/5 dark:shadow-none">
        <CardHeader className="gap-3 border-b border-border/70">
          <CardDescription className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Edit surface</CardDescription>
          <CardTitle className="text-2xl font-semibold tracking-tight">{t('items.edit.title')}</CardTitle>
          <CardDescription>{getItemDisplayName(currentItem)}</CardDescription>
        </CardHeader>
      </Card>

      <form
        onSubmit={(event) => {
          event.preventDefault()

          if (blockWhenLensInvalid()) {
            return
          }

          setSaveConfirmOpen(true)
        }}
        className="animate-fade-up space-y-6"
      >
        <Card className="border border-border bg-card/95 shadow-sm shadow-black/5 dark:shadow-none">
          <CardHeader className="gap-2 border-b border-border/70">
            <CardTitle className="text-base">Primary fields</CardTitle>
            <CardDescription>Keep high-value edits, custom fields, and technical review in separate readable zones.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-4 md:grid-cols-2">
          {currentItem.item_type === 'FinancialItem' ? (
            <EditFieldShell className="md:col-span-2">
              <Label htmlFor="edit-financial-subtype" className={editFieldLabelClassName}>{t('items.wizard.typeLabel')}</Label>
              <Select value={draftFinancialSubtype} onValueChange={(value) => setDraftFinancialSubtype(value as FinancialSubtype)}>
                <SelectTrigger id="edit-financial-subtype" aria-label={t('items.wizard.typeLabel')} className="h-10 w-full bg-background/90 px-3 py-2 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Commitment">Commitment</SelectItem>
                  <SelectItem value="Income">Income</SelectItem>
                </SelectContent>
              </Select>
            </EditFieldShell>
          ) : null}

          {currentItem.item_type === 'FinancialItem' ? (
            <EditFieldShell className="md:col-span-2">
              <Label htmlFor="edit-financial-frequency" className={editFieldLabelClassName}>{t('items.fields.billingCycle')}</Label>
              <Select value={draftFinancialFrequency} onValueChange={(value) => setDraftFinancialFrequency(value as FinancialFrequency)}>
                <SelectTrigger id="edit-financial-frequency" aria-label={t('items.fields.billingCycle')} className="h-10 w-full bg-background/90 px-3 py-2 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCIAL_FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`items.detail.recurrence.${option === 'one_time' ? 'oneTime' : option}`, { defaultValue: option })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditFieldShell>
          ) : null}

          {editableEntries.map(([key, value]) => {
            const initialValue = initialAttributes[key]
            const isDescription = key.toLowerCase().includes('description')
            const isDate = key.toLowerCase().includes('date')
            const isNumber = typeof initialValue === 'number'
            const isBoolean = typeof initialValue === 'boolean'
            const isMoney = isMoneyField(key)

            return (
              <EditFieldShell key={key} className={isDescription ? 'md:col-span-2' : ''}>
                <Label htmlFor={`item-edit-${key}`} className={editFieldLabelClassName}>{t(`items.fields.${key}`, { defaultValue: key })}</Label>

                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    {isDescription ? (
                      <Textarea
                        id={`item-edit-${key}`}
                        rows={3}
                        value={typeof value === 'string' ? value : String(value ?? '')}
                        onChange={(inputEvent) => setDraftAttributes((current) => ({ ...current, [key]: inputEvent.target.value }))}
                        className="min-h-28 bg-background/90 px-3 py-2 text-sm"
                      />
                    ) : isBoolean ? (
                      <label className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/70 px-4 py-3">
                        <input id={`item-edit-${key}`} type="checkbox" checked={Boolean(value)} onChange={(inputEvent) => setDraftAttributes((current) => ({ ...current, [key]: inputEvent.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-border" />
                        <span className={editFieldHintClassName}>Toggle this flag directly from the edit surface.</span>
                      </label>
                    ) : isMoney ? (
                      <Input
                        id={`item-edit-${key}`}
                        type="text"
                        inputMode="decimal"
                        value={typeof value === 'string' || typeof value === 'number' ? formatCurrencyInput(value) : ''}
                        onChange={(inputEvent) =>
                          setDraftAttributes((current) => ({
                            ...current,
                            [key]: normalizeCurrencyInput(inputEvent.target.value),
                          }))
                        }
                        className="h-10 w-full bg-background/90 px-3 py-2 text-sm"
                      />
                    ) : (
                      <Input
                        id={`item-edit-${key}`}
                        type={isDate ? 'date' : isNumber ? 'number' : 'text'}
                        step={isNumber ? 'any' : undefined}
                        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                        onChange={(inputEvent) =>
                          setDraftAttributes((current) => ({
                            ...current,
                            [key]: inputEvent.target.value,
                          }))
                        }
                        className="h-10 w-full bg-background/90 px-3 py-2 text-sm"
                      />
                    )}
                  </div>

                  {!['amount', 'dueDate', 'billingCycle', 'address', 'estimatedValue', 'vin'].includes(key) ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDraftAttributes((current) => {
                          const next = { ...current }
                          delete next[key]
                          return next
                        })
                      }}
                    >
                      {t('items.edit.removeField')}
                    </Button>
                  ) : null}
                </div>
              </EditFieldShell>
            )
          })}
            </div>

            <section className="rounded-xl border border-border bg-background/70 p-4">
              <p className={editFieldLabelClassName}>{t('items.edit.customFieldsTitle')}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input
              value={newFieldKey}
              onChange={(event) => setNewFieldKey(event.target.value)}
              placeholder={t('items.edit.customFieldNamePlaceholder')}
              className="h-10 bg-background/90 px-3 py-2 text-sm"
            />
            <Input
              value={newFieldValue}
              onChange={(event) => setNewFieldValue(event.target.value)}
              placeholder={t('items.edit.customFieldValuePlaceholder')}
              className="h-10 bg-background/90 px-3 py-2 text-sm"
            />
            <Button type="button" variant="outline" className="hover-lift px-4" onClick={addCustomField}>
              {t('items.edit.addCustomField')}
            </Button>
          </div>
        </section>

        <div className="space-y-3">
          <Button type="button" variant="outline" className="w-full justify-between sm:w-auto" onClick={() => setShowTechnical((value) => !value)}>
            {showTechnical ? t('items.edit.hideTechnical') : t('items.edit.showTechnical')}
          </Button>
        </div>

        <div className="ui-expand" data-open={showTechnical}>
          {showTechnical ? (
            <div className="space-y-2">
              <p className={editFieldLabelClassName}>{t('items.edit.technicalSnapshot')}</p>
              <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs">{technicalSnapshot}</pre>
            </div>
          ) : null}
        </div>

        {errorText ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{errorText}</p> : null}

        {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} /> : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={updateMutation.isPending || !hasUnsavedChanges}
            className="hover-lift px-4"
          >
            {updateMutation.isPending ? t('items.edit.saving') : t('items.edit.saveAction')}
          </Button>
          <Button asChild variant="outline" className="px-4">
            <Link to={`/items/${itemId}`}>{t('items.edit.cancelAction')}</Link>
          </Button>
        </div>
          </CardContent>
        </Card>
      </form>

      <ConfirmationDialog
        open={saveConfirmOpen}
        title={t('items.edit.confirmSaveTitle')}
        description={
          <span className="space-y-2">
            <span className="block">{t('items.edit.confirmSave')}</span>
            {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} /> : null}
          </span>
        }
        confirmLabel={updateMutation.isPending ? t('items.edit.saving') : t('items.edit.saveAction')}
        cancelLabel={t('items.edit.cancelAction')}
        pending={updateMutation.isPending}
        onCancel={() => setSaveConfirmOpen(false)}
        onConfirm={() => {
          if (blockWhenLensInvalid()) {
            setSaveConfirmOpen(false)
            return
          }

          updateMutation.mutate()
        }}
      />

      <ConfirmationDialog
        open={unsavedGuard.open}
        title={t('items.form.unsavedTitle')}
        description={t('items.form.unsavedWarning')}
        confirmLabel={t('items.form.leaveAction')}
        cancelLabel={t('items.form.stayAction')}
        onCancel={() => unsavedGuard.stay()}
        onConfirm={() => unsavedGuard.proceed()}
      />
    </section>
  )
}
