import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-label="Loading item edit">
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
    <section className="space-y-4">
      <header className="animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t('items.edit.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{getItemDisplayName(currentItem)}</p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault()

          if (blockWhenLensInvalid()) {
            return
          }

          setSaveConfirmOpen(true)
        }}
        className="animate-fade-up space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {currentItem.item_type === 'FinancialItem' ? (
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.typeLabel')}</span>
              <select
                value={draftFinancialSubtype}
                onChange={(event) => setDraftFinancialSubtype(event.target.value as FinancialSubtype)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="Commitment">Commitment</option>
                <option value="Income">Income</option>
              </select>
            </label>
          ) : null}

          {currentItem.item_type === 'FinancialItem' ? (
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.billingCycle')}</span>
              <select
                value={draftFinancialFrequency}
                onChange={(event) => setDraftFinancialFrequency(event.target.value as FinancialFrequency)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {FINANCIAL_FREQUENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`items.detail.recurrence.${option === 'one_time' ? 'oneTime' : option}`, { defaultValue: option })}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {editableEntries.map(([key, value]) => {
            const initialValue = initialAttributes[key]
            const isDescription = key.toLowerCase().includes('description')
            const isDate = key.toLowerCase().includes('date')
            const isNumber = typeof initialValue === 'number'
            const isBoolean = typeof initialValue === 'boolean'
            const isMoney = isMoneyField(key)

            return (
              <label key={key} className={isDescription ? 'space-y-1 md:col-span-2' : 'space-y-1'}>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(`items.fields.${key}`, { defaultValue: key })}</span>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    {isDescription ? (
                      <textarea
                        rows={3}
                        value={typeof value === 'string' ? value : String(value ?? '')}
                        onChange={(inputEvent) => setDraftAttributes((current) => ({ ...current, [key]: inputEvent.target.value }))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                    ) : isBoolean ? (
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(inputEvent) => setDraftAttributes((current) => ({ ...current, [key]: inputEvent.target.checked }))}
                        className="h-4 w-4 rounded border-border"
                      />
                    ) : isMoney ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={typeof value === 'string' || typeof value === 'number' ? formatCurrencyInput(value) : ''}
                        onChange={(inputEvent) =>
                          setDraftAttributes((current) => ({
                            ...current,
                            [key]: normalizeCurrencyInput(inputEvent.target.value),
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                    ) : (
                      <input
                        type={isDate ? 'date' : isNumber ? 'number' : 'text'}
                        step={isNumber ? 'any' : undefined}
                        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                        onChange={(inputEvent) =>
                          setDraftAttributes((current) => ({
                            ...current,
                            [key]: inputEvent.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                    )}
                  </div>

                  {!['amount', 'dueDate', 'billingCycle', 'address', 'estimatedValue', 'vin'].includes(key) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftAttributes((current) => {
                          const next = { ...current }
                          delete next[key]
                          return next
                        })
                      }}
                      className="rounded border border-destructive/30 px-2 py-1 text-xs text-destructive"
                    >
                      {t('items.edit.removeField')}
                    </button>
                  ) : null}
                </div>
              </label>
            )
          })}
        </div>

        <section className="rounded-xl border border-border bg-background/70 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.edit.customFieldsTitle')}</p>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input
              value={newFieldKey}
              onChange={(event) => setNewFieldKey(event.target.value)}
              placeholder={t('items.edit.customFieldNamePlaceholder')}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={newFieldValue}
              onChange={(event) => setNewFieldValue(event.target.value)}
              placeholder={t('items.edit.customFieldValuePlaceholder')}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button type="button" onClick={addCustomField} className="hover-lift rounded-lg border border-border px-3 py-2 text-sm font-medium">
              {t('items.edit.addCustomField')}
            </button>
          </div>
        </section>

        <div>
          <button type="button" onClick={() => setShowTechnical((value) => !value)} className="rounded-lg border border-border px-3 py-2 text-xs font-medium">
            {showTechnical ? t('items.edit.hideTechnical') : t('items.edit.showTechnical')}
          </button>
        </div>

        <div className="ui-expand" data-open={showTechnical}>
          {showTechnical ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.edit.technicalSnapshot')}</p>
              <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs">{technicalSnapshot}</pre>
            </div>
          ) : null}
        </div>

        {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}

        {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} /> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={updateMutation.isPending || !hasUnsavedChanges}
            className="hover-lift rounded-lg border border-primary/25 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updateMutation.isPending ? t('items.edit.saving') : t('items.edit.saveAction')}
          </button>
          <Link to={`/items/${itemId}`} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
            {t('items.edit.cancelAction')}
          </Link>
        </div>
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
