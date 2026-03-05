import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ConfirmationDialog } from '../../features/ui/confirmation-dialog'
import { ApiClientError, type ApiIssue, apiRequest } from '../../lib/api-client'
import { getItemDisplayName } from '../../lib/item-display'
import { useUnsavedChangesGuard } from '../../features/items/use-unsaved-changes-guard'
import { queryKeys } from '../../lib/query-keys'

type FinancialSubtype = 'Commitment' | 'Income'
type FinancialFrequency = 'one_time' | 'weekly' | 'monthly' | 'yearly'
type FinancialStatus = 'Active' | 'Closed'
type CreateItemType = 'FinancialItem' | 'Vehicle' | 'RealEstate'

type ItemRow = {
  id: string
  item_type: string
  attributes: Record<string, unknown>
}

type ItemsResponse = {
  items: ItemRow[]
}

type FinancialItemResponse = ItemRow & {
  title?: string | null
}

type FormField =
  | 'item_type'
  | 'title'
  | 'type'
  | 'frequency'
  | 'default_amount'
  | 'status'
  | 'dueDate'
  | 'linked_asset_item_id'
  | 'vin'
  | 'address'
  | 'estimatedValue'
  | 'dynamicTrackingEnabled'
  | 'trackingStartingRemainingBalance'
  | 'trackingStartingCollectedTotal'

type FormValues = {
  item_type: CreateItemType
  linked_asset_item_id: string
  title: string
  type: FinancialSubtype
  frequency: FinancialFrequency
  default_amount: string
  status: FinancialStatus
  dueDate: string
  description: string
  dynamicTrackingEnabled: boolean
  trackingStartingRemainingBalance: string
  trackingStartingCollectedTotal: string
  vin: string
  address: string
  estimatedValue: string
  make: string
  model: string
  year: string
}

const DEFAULT_VALUES: FormValues = {
  item_type: 'FinancialItem',
  linked_asset_item_id: '',
  title: '',
  type: 'Commitment',
  frequency: 'monthly',
  default_amount: '',
  status: 'Active',
  dueDate: '',
  description: '',
  dynamicTrackingEnabled: true,
  trackingStartingRemainingBalance: '',
  trackingStartingCollectedTotal: '0',
  vin: '',
  address: '',
  estimatedValue: '',
  make: '',
  model: '',
  year: '',
}

const FREQUENCY_OPTIONS: FinancialFrequency[] = ['one_time', 'weekly', 'monthly', 'yearly']
const FREQUENCY_LABELS: Record<FinancialFrequency, string> = {
  one_time: 'One-time',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

function formatCurrencyInput(value: string) {
  const normalized = normalizeCurrencyInput(value)
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

function formatCurrencyReview(value: string, fallback = '-') {
  const formatted = formatCurrencyInput(value)
  return formatted || fallback
}

function buildAttributes(values: FormValues) {
  const amount = toNumber(values.default_amount)
  const recurring = values.frequency !== 'one_time'
  const trackingStartingRemainingBalance = toNumber(values.trackingStartingRemainingBalance)
  const trackingStartingCollectedTotal = toNumber(values.trackingStartingCollectedTotal)

  return {
    dueDate: values.dueDate,
    description: values.description,
    financialSubtype: values.type,
    name: values.title,
    billingCycle: values.frequency,
    status: values.status,
    ...(recurring
      ? {
          dynamicTrackingEnabled: values.dynamicTrackingEnabled,
          ...(values.dynamicTrackingEnabled && values.type === 'Commitment' && trackingStartingRemainingBalance !== null
            ? { trackingStartingRemainingBalance }
            : {}),
          ...(values.dynamicTrackingEnabled && values.type === 'Income'
            ? { trackingStartingCollectedTotal: trackingStartingCollectedTotal ?? 0 }
            : {}),
        }
      : {}),
    ...(values.linked_asset_item_id ? { linkedAssetItemId: values.linked_asset_item_id, parentItemId: values.linked_asset_item_id } : {}),
    ...(amount !== null ? { amount } : {}),
  }
}

function mapIssueField(field: string): FormField | null {
  if (field === 'item_type') {
    return 'item_type'
  }
  if (field === 'title') {
    return 'title'
  }
  if (field === 'type') {
    return 'type'
  }
  if (field === 'frequency') {
    return 'frequency'
  }
  if (field === 'default_amount') {
    return 'default_amount'
  }
  if (field === 'status') {
    return 'status'
  }
  if (field === 'attributes') {
    return 'dueDate'
  }
  if (field === 'confirm_unlinked_asset' || field === 'linked_asset_item_id') {
    return 'linked_asset_item_id'
  }
  return null
}

function mapSubtypeFromQuery(param: string | null): FinancialSubtype | null {
  if (param === 'Commitment' || param === 'FinancialCommitment') {
    return 'Commitment'
  }
  if (param === 'Income' || param === 'FinancialIncome') {
    return 'Income'
  }
  return null
}

function mapCreateTypeFromQuery(param: string | null): CreateItemType {
  if (param === 'Vehicle') {
    return 'Vehicle'
  }

  if (param === 'RealEstate') {
    return 'RealEstate'
  }

  return 'FinancialItem'
}

function createActionLabel(t: (key: string, options?: Record<string, unknown>) => string, itemType: CreateItemType) {
  if (itemType === 'Vehicle') {
    return t('items.wizard.createVehicleAction')
  }

  if (itemType === 'RealEstate') {
    return t('items.wizard.createRealEstateAction')
  }

  return t('items.wizard.createAction')
}

function collectIssueMessages(issues: ApiIssue[]) {
  const values = new Set<string>()
  issues.forEach((issue) => values.add(issue.message))
  return Array.from(values)
}

export function ItemCreateWizardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [values, setValues] = useState<FormValues>(DEFAULT_VALUES)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({})
  const [summaryErrors, setSummaryErrors] = useState<string[]>([])
  const [showTechnicalReview, setShowTechnicalReview] = useState(false)
  const [showUnlinkedAssetDialog, setShowUnlinkedAssetDialog] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [suppressUnsavedGuard, setSuppressUnsavedGuard] = useState(false)
  const isFinancial = values.item_type === 'FinancialItem'
  const isVehicle = values.item_type === 'Vehicle'
  const isRealEstate = values.item_type === 'RealEstate'
  const isCommitment = values.type === 'Commitment'
  const isRecurring = values.frequency !== 'one_time'
  const createLabel = createActionLabel(t, values.item_type)

  const assetsQuery = useQuery({
    queryKey: queryKeys.items.list({ filter: 'assets', sort: 'recently_updated' }),
    queryFn: async () => apiRequest<ItemsResponse>('/items?filter=assets&sort=recently_updated'),
  })

  useEffect(() => {
    const typeParam = searchParams.get('type') ?? searchParams.get('item_type')
    const linkedAssetParam = searchParams.get('linked_asset_item_id') ?? searchParams.get('parent_item_id')
    const subtype = mapSubtypeFromQuery(typeParam)
    const createType = mapCreateTypeFromQuery(typeParam)

    setValues((current) => ({
      ...current,
      item_type: createType,
      type: subtype ?? current.type,
      linked_asset_item_id: linkedAssetParam ?? current.linked_asset_item_id,
    }))
  }, [searchParams])

  const reviewRows = useMemo(() => {
    const linkedAsset = (assetsQuery.data?.items ?? []).find((item) => item.id === values.linked_asset_item_id)
    if (values.item_type === 'Vehicle') {
      return [
        { label: t('items.wizard.itemTypeLabel'), value: t('items.wizard.itemTypeOptions.Vehicle') },
        { label: t('items.fields.name'), value: values.title || '-' },
        { label: t('items.fields.vin'), value: values.vin || '-' },
        { label: t('items.fields.estimatedValue'), value: formatCurrencyReview(values.estimatedValue) },
      ]
    }

    if (values.item_type === 'RealEstate') {
      return [
        { label: t('items.wizard.itemTypeLabel'), value: t('items.wizard.itemTypeOptions.RealEstate') },
        { label: t('items.fields.name'), value: values.title || '-' },
        { label: t('items.fields.address'), value: values.address || '-' },
        { label: t('items.fields.estimatedValue'), value: formatCurrencyReview(values.estimatedValue) },
      ]
    }

    return [
      { label: t('items.wizard.itemTypeLabel'), value: t('items.wizard.itemTypeOptions.FinancialItem') },
      { label: t('items.fields.name'), value: values.title || '-' },
      { label: t('items.wizard.typeLabel'), value: values.type },
      { label: t('items.fields.billingCycle'), value: FREQUENCY_LABELS[values.frequency] },
      {
        label: t('items.wizard.dynamicTrackingLabel'),
        value: isRecurring ? (values.dynamicTrackingEnabled ? 'Yes' : 'No') : '-',
      },
      ...(isRecurring && values.dynamicTrackingEnabled && values.type === 'Commitment'
        ? [{ label: t('items.wizard.startingRemainingLabel'), value: formatCurrencyReview(values.trackingStartingRemainingBalance) }]
        : []),
      ...(isRecurring && values.dynamicTrackingEnabled && values.type === 'Income'
        ? [{ label: t('items.wizard.startingCollectedLabel'), value: formatCurrencyReview(values.trackingStartingCollectedTotal, '$0') }]
        : []),
      { label: t('items.fields.amount'), value: formatCurrencyReview(values.default_amount) },
      { label: t('items.fields.dueDate'), value: values.dueDate || '-' },
      { label: t('items.fields.parentAsset'), value: linkedAsset ? getItemDisplayName(linkedAsset) : '-' },
    ]
  }, [
    assetsQuery.data?.items,
    isRecurring,
    t,
    values.address,
    values.default_amount,
    values.dueDate,
    values.dynamicTrackingEnabled,
    values.estimatedValue,
    values.frequency,
    values.item_type,
    values.linked_asset_item_id,
    values.title,
    values.trackingStartingCollectedTotal,
    values.trackingStartingRemainingBalance,
    values.type,
    values.vin,
  ])

  const technicalSummary = useMemo(
    () => {
      if (values.item_type === 'Vehicle') {
        return JSON.stringify(
          {
            item_type: 'Vehicle',
            attributes: {
              name: values.title,
              vin: values.vin,
              estimatedValue: toNumber(values.estimatedValue),
              make: values.make,
              model: values.model,
              year: toNumber(values.year),
              description: values.description,
            },
          },
          null,
          2,
        )
      }

      if (values.item_type === 'RealEstate') {
        return JSON.stringify(
          {
            item_type: 'RealEstate',
            attributes: {
              name: values.title,
              address: values.address,
              estimatedValue: toNumber(values.estimatedValue),
              description: values.description,
            },
          },
          null,
          2,
        )
      }

      return JSON.stringify(
        {
          item_type: 'FinancialItem',
          title: values.title,
          type: values.type,
          frequency: values.frequency,
          default_amount: toNumber(values.default_amount),
          status: values.status,
          has_linked_parent_asset: Boolean(values.linked_asset_item_id),
          confirm_unlinked_asset: Boolean(values.linked_asset_item_id),
          attributes: buildAttributes(values),
        },
        null,
        2,
      )
    },
    [values],
  )

  const createMutation = useMutation({
    mutationFn: async ({ payload, confirmUnlinkedAsset }: { payload: FormValues; confirmUnlinkedAsset: boolean }) => {
      const requestBody =
        payload.item_type === 'Vehicle'
          ? {
              item_type: 'Vehicle',
              attributes: {
                name: payload.title,
                vin: payload.vin,
                estimatedValue: Number(payload.estimatedValue),
                make: payload.make,
                model: payload.model,
                year: toNumber(payload.year),
                description: payload.description,
              },
            }
          : payload.item_type === 'RealEstate'
            ? {
                item_type: 'RealEstate',
                attributes: {
                  name: payload.title,
                  address: payload.address,
                  estimatedValue: Number(payload.estimatedValue),
                  description: payload.description,
                },
              }
            : {
                item_type: 'FinancialItem',
                title: payload.title,
                type: payload.type,
                frequency: payload.frequency,
                default_amount: Number(payload.default_amount),
                status: payload.status,
                parent_item_id: payload.linked_asset_item_id || null,
                linked_asset_item_id: payload.linked_asset_item_id || null,
                confirm_unlinked_asset: confirmUnlinkedAsset,
                attributes: buildAttributes(payload),
              }

      const created = await apiRequest<FinancialItemResponse>('/items', {
        method: 'POST',
        body: requestBody,
      })
      return created
    },
    onSuccess: async (created) => {
      setDirty(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
      navigate(`/items/${created.id}`)
    },
    onError: () => {
      setSuppressUnsavedGuard(false)
    },
  })

  const errorText = useMemo(() => {
    if (createMutation.error instanceof ApiClientError) {
      return createMutation.error.message
    }
    if (createMutation.isError) {
      return t('items.wizard.createError')
    }
    return null
  }, [createMutation.error, createMutation.isError, t])

  const unsavedGuard = useUnsavedChangesGuard(dirty && !suppressUnsavedGuard)

  const inputClassName = (field: FormField) =>
    `w-full rounded-lg border bg-background px-3 py-2 text-sm ${fieldErrors[field] ? 'border-destructive ring-1 ring-destructive/30' : 'border-border'}`

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setSuppressUnsavedGuard(false)
    setDirty(true)
    setSummaryErrors([])
    setFieldErrors((current) => {
      if (!(key in current)) {
        return current
      }

      const { [key]: _removed, ...remaining } = current
      return remaining
    })
  }

  function validate(valuesToValidate: FormValues) {
    const nextFieldErrors: Partial<Record<FormField, string>> = {}

    if (valuesToValidate.item_type === 'Vehicle') {
      if (!valuesToValidate.vin.trim()) {
        nextFieldErrors.vin = t('items.wizard.fieldRequired')
      }

      if (!valuesToValidate.estimatedValue.trim() || toNumber(valuesToValidate.estimatedValue) === null || Number(valuesToValidate.estimatedValue) < 0) {
        nextFieldErrors.estimatedValue = t('items.wizard.requiredMissing')
      }

      return nextFieldErrors
    }

    if (valuesToValidate.item_type === 'RealEstate') {
      if (!valuesToValidate.address.trim()) {
        nextFieldErrors.address = t('items.wizard.fieldRequired')
      }

      if (!valuesToValidate.estimatedValue.trim() || toNumber(valuesToValidate.estimatedValue) === null || Number(valuesToValidate.estimatedValue) < 0) {
        nextFieldErrors.estimatedValue = t('items.wizard.requiredMissing')
      }

      return nextFieldErrors
    }

    if (!valuesToValidate.title.trim()) {
      nextFieldErrors.title = t('items.wizard.fieldRequired')
    }
    if (!valuesToValidate.default_amount.trim() || toNumber(valuesToValidate.default_amount) === null || Number(valuesToValidate.default_amount) < 0) {
      nextFieldErrors.default_amount = t('items.wizard.requiredMissing')
    }
    if (!valuesToValidate.dueDate.trim()) {
      nextFieldErrors.dueDate = t('items.wizard.fieldRequired')
    }

    return nextFieldErrors
  }

  function applyApiIssues(error: ApiClientError) {
    if (error.issues.length === 0) {
      return
    }

    const nextFieldErrors: Partial<Record<FormField, string>> = {}
    error.issues.forEach((issue) => {
      let target = mapIssueField(issue.field)
      if (!target && issue.field === 'attributes') {
        const message = issue.message.toLowerCase()
        if (message.includes('vin')) {
          target = 'vin'
        } else if (message.includes('address')) {
          target = 'address'
        } else if (message.includes('estimated')) {
          target = 'estimatedValue'
        } else if (message.includes('duedate')) {
          target = 'dueDate'
        }
      }

      if (target) {
        nextFieldErrors[target] = issue.message
      }
    })

    setFieldErrors(nextFieldErrors)
    setSummaryErrors(collectIssueMessages(error.issues))
  }

  function submitForm(confirmUnlinkedAsset: boolean) {
    const nextFieldErrors = validate(values)
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setSummaryErrors(Object.values(nextFieldErrors))
      return
    }

    if (values.item_type === 'FinancialItem' && !values.linked_asset_item_id && !confirmUnlinkedAsset) {
      setShowUnlinkedAssetDialog(true)
      return
    }

    setSuppressUnsavedGuard(true)
    setSummaryErrors([])
    createMutation.mutate({ payload: values, confirmUnlinkedAsset }, {
      onError: (error) => {
        if (error instanceof ApiClientError) {
          applyApiIssues(error)
        }
        setSuppressUnsavedGuard(false)
      },
    })
  }

  return (
    <section className="space-y-4">
      <header className="animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t('items.wizard.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{createLabel}</p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submitForm(false)
        }}
        className="animate-fade-up space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        {summaryErrors.length > 0 ? (
          <section className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">{t('items.wizard.requiredMissing')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {summaryErrors.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.itemTypeLabel')} *</span>
          <select value={values.item_type} onChange={(event) => updateField('item_type', event.target.value as CreateItemType)} className={inputClassName('item_type')}>
            <option value="FinancialItem">{t('items.wizard.itemTypeOptions.FinancialItem')}</option>
            <option value="Vehicle">{t('items.wizard.itemTypeOptions.Vehicle')}</option>
            <option value="RealEstate">{t('items.wizard.itemTypeOptions.RealEstate')}</option>
          </select>
          {fieldErrors.item_type ? <p className="text-xs text-destructive">{fieldErrors.item_type}</p> : null}
        </label>

        {isFinancial ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.name')} *</span>
                <input value={values.title} onChange={(event) => updateField('title', event.target.value)} className={inputClassName('title')} />
                {fieldErrors.title ? <p className="text-xs text-destructive">{fieldErrors.title}</p> : null}
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.typeLabel')} *</span>
                <select value={values.type} onChange={(event) => updateField('type', event.target.value as FinancialSubtype)} className={inputClassName('type')}>
                  <option value="Commitment">Commitment</option>
                  <option value="Income">Income</option>
                </select>
                {fieldErrors.type ? <p className="text-xs text-destructive">{fieldErrors.type}</p> : null}
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.billingCycle')} *</span>
                <select value={values.frequency} onChange={(event) => updateField('frequency', event.target.value as FinancialFrequency)} className={inputClassName('frequency')}>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {FREQUENCY_LABELS[option]}
                    </option>
                  ))}
                </select>
                {fieldErrors.frequency ? <p className="text-xs text-destructive">{fieldErrors.frequency}</p> : null}
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.amount')} *</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatCurrencyInput(values.default_amount)}
                  onChange={(event) => updateField('default_amount', normalizeCurrencyInput(event.target.value))}
                  className={inputClassName('default_amount')}
                />
                {fieldErrors.default_amount ? <p className="text-xs text-destructive">{fieldErrors.default_amount}</p> : null}
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status *</span>
                <select value={values.status} onChange={(event) => updateField('status', event.target.value as FinancialStatus)} className={inputClassName('status')}>
                  <option value="Active">Active</option>
                  <option value="Closed">Closed</option>
                </select>
                {fieldErrors.status ? <p className="text-xs text-destructive">{fieldErrors.status}</p> : null}
              </label>
            </div>

            <section className="rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
              {isRecurring ? t('items.fields.billingCycle') + ': ' + FREQUENCY_LABELS[values.frequency] : t('items.fields.billingCycle') + ': ' + FREQUENCY_LABELS.one_time}
            </section>

            {isRecurring ? (
              <section className="space-y-3 rounded-xl border border-border bg-background/60 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={values.dynamicTrackingEnabled}
                    onChange={(event) => updateField('dynamicTrackingEnabled', event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="font-medium text-foreground">{t('items.wizard.dynamicTrackingLabel')}</span>
                </label>

                {values.dynamicTrackingEnabled && values.type === 'Commitment' ? (
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.startingRemainingLabel')}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatCurrencyInput(values.trackingStartingRemainingBalance)}
                      onChange={(event) => updateField('trackingStartingRemainingBalance', normalizeCurrencyInput(event.target.value))}
                      className={inputClassName('trackingStartingRemainingBalance')}
                    />
                    <p className="text-xs text-muted-foreground">{t('items.wizard.startingRemainingHint')}</p>
                  </label>
                ) : null}

                {values.dynamicTrackingEnabled && values.type === 'Income' ? (
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.startingCollectedLabel')}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatCurrencyInput(values.trackingStartingCollectedTotal)}
                      onChange={(event) => updateField('trackingStartingCollectedTotal', normalizeCurrencyInput(event.target.value))}
                      className={inputClassName('trackingStartingCollectedTotal')}
                    />
                    <p className="text-xs text-muted-foreground">{t('items.wizard.startingCollectedHint')}</p>
                  </label>
                ) : null}
              </section>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{isRecurring ? t('items.fields.dueDate') : t('items.wizard.dueDateLabel')} *</span>
                <input type="date" value={values.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} className={inputClassName('dueDate')} />
                {fieldErrors.dueDate ? <p className="text-xs text-destructive">{fieldErrors.dueDate}</p> : null}
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.parentOptionalLabel')}</span>
                <select
                  value={values.linked_asset_item_id}
                  onChange={(event) => updateField('linked_asset_item_id', event.target.value)}
                  className={`w-full rounded-lg border bg-background px-3 py-2 text-sm ${fieldErrors.linked_asset_item_id ? 'border-destructive ring-1 ring-destructive/30' : 'border-border'}`}
                >
                  <option value="">{t('items.wizard.parentPlaceholder')}</option>
                  {(assetsQuery.data?.items ?? []).map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {getItemDisplayName(asset)}
                    </option>
                  ))}
                </select>
                {isCommitment ? <p className="text-xs text-muted-foreground">{t('items.wizard.parentOptionalLabel')}</p> : null}
                {fieldErrors.linked_asset_item_id ? <p className="text-xs text-destructive">{fieldErrors.linked_asset_item_id}</p> : null}
              </label>
            </div>
          </>
        ) : null}

        {isVehicle ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.name')}</span>
                <input value={values.title} onChange={(event) => updateField('title', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.vin')} *</span>
                <input value={values.vin} onChange={(event) => updateField('vin', event.target.value)} className={inputClassName('vin')} />
                {fieldErrors.vin ? <p className="text-xs text-destructive">{fieldErrors.vin}</p> : null}
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.estimatedValue')} *</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatCurrencyInput(values.estimatedValue)}
                  onChange={(event) => updateField('estimatedValue', normalizeCurrencyInput(event.target.value))}
                  className={inputClassName('estimatedValue')}
                />
                {fieldErrors.estimatedValue ? <p className="text-xs text-destructive">{fieldErrors.estimatedValue}</p> : null}
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.make')}</span>
                <input value={values.make} onChange={(event) => updateField('make', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.model')}</span>
                <input value={values.model} onChange={(event) => updateField('model', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
            </div>
          </>
        ) : null}

        {isRealEstate ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.name')}</span>
                <input value={values.title} onChange={(event) => updateField('title', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.address')} *</span>
                <input value={values.address} onChange={(event) => updateField('address', event.target.value)} className={inputClassName('address')} />
                {fieldErrors.address ? <p className="text-xs text-destructive">{fieldErrors.address}</p> : null}
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.estimatedValue')} *</span>
              <input
                type="text"
                inputMode="decimal"
                value={formatCurrencyInput(values.estimatedValue)}
                onChange={(event) => updateField('estimatedValue', normalizeCurrencyInput(event.target.value))}
                className={inputClassName('estimatedValue')}
              />
              {fieldErrors.estimatedValue ? <p className="text-xs text-destructive">{fieldErrors.estimatedValue}</p> : null}
            </label>
          </>
        ) : null}

        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.description')}</span>
          <textarea rows={2} value={values.description} onChange={(event) => updateField('description', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.reviewLabel')}</p>
          <div className="space-y-2 rounded-xl border border-border bg-background/70 p-3">
            {reviewRows.map((row) => (
              <div key={row.label} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-b-0 last:pb-0">
                <span className="text-xs text-muted-foreground">{row.label}</span>
                <span className="text-sm font-medium">{row.value}</span>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setShowTechnicalReview((value) => !value)} className="rounded-lg border border-border px-3 py-2 text-xs font-medium">
            {showTechnicalReview ? t('items.wizard.hideTechnicalReview') : t('items.wizard.showTechnicalReview')}
          </button>

          <div className="ui-expand" data-open={showTechnicalReview}>
            {showTechnicalReview ? <textarea value={technicalSummary} readOnly rows={12} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm" /> : null}
          </div>
        </div>

        {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={createMutation.isPending} className="hover-lift rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
            {createMutation.isPending ? t('items.wizard.creating') : createLabel}
          </button>
          <Link to="/items" className="hover-lift rounded-lg border border-border px-4 py-2 text-sm font-medium">
            {t('items.wizard.cancelAction')}
          </Link>
        </div>
      </form>

      <ConfirmationDialog
        open={showUnlinkedAssetDialog}
        title={t('items.wizard.unlinkedWarningTitle')}
        description={t('items.wizard.unlinkedWarningDescription')}
        confirmLabel={t('items.wizard.unlinkedConfirmAction')}
        cancelLabel={t('items.wizard.unlinkedCancelAction')}
        pending={createMutation.isPending}
        onCancel={() => setShowUnlinkedAssetDialog(false)}
        onConfirm={() => {
          setShowUnlinkedAssetDialog(false)
          submitForm(true)
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
