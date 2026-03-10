import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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

  const endsWithDecimalPoint = sanitized.endsWith('.')
  const [wholePartRaw, ...decimalParts] = sanitized.split('.')
  const wholePart = wholePartRaw.replace(/^0+(?=\d)/, '') || '0'
  const decimals = decimalParts.join('').slice(0, 2)

  if (endsWithDecimalPoint && decimals.length === 0) {
    return `${wholePart}.`
  }

  return decimals.length > 0 ? `${wholePart}.${decimals}` : wholePart
}

function formatCurrencyInput(value: string) {
  const normalized = normalizeCurrencyInput(value)
  if (!normalized) {
    return ''
  }

  const [wholePart, decimals = ''] = normalized.split('.')
  const groupedWhole = Number(wholePart).toLocaleString()

  if (normalized.endsWith('.') && decimals.length === 0) {
    return `$${groupedWhole}.`
  }

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

const fieldLabelClassName = 'text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground'
const fieldErrorClassName = 'text-xs text-destructive'
const fieldHintClassName = 'text-xs leading-relaxed text-muted-foreground'

function FormFieldShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`.trim()}>{children}</div>
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="max-w-full text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  )
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
      navigate(`/items/${created.id}`, {
        state: {
          from: '/items',
          highlightItemId: created.id,
          highlightSource: 'created',
        },
      })
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
    `h-10 w-full bg-background/90 px-3 py-2 text-sm shadow-none ${fieldErrors[field] ? 'aria-invalid:border-destructive aria-invalid:ring-destructive/20' : ''}`

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
    <section className="space-y-6">
      <Card className="animate-fade-up border border-border bg-card/95 shadow-sm shadow-black/5 dark:shadow-none">
        <CardHeader className="gap-3 border-b border-border/70">
          <CardDescription className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('items.wizard.reviewLabel')}</CardDescription>
          <CardTitle className="text-2xl font-semibold tracking-tight">{t('items.wizard.title')}</CardTitle>
          <CardDescription>{createLabel}</CardDescription>
        </CardHeader>
      </Card>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submitForm(false)
        }}
        className="animate-fade-up space-y-6"
      >
        {summaryErrors.length > 0 ? (
          <section className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <p className="font-medium">{t('items.wizard.requiredMissing')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {summaryErrors.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <Card className="border border-border bg-card/95 shadow-sm shadow-black/5 dark:shadow-none">
          <CardHeader className="gap-2 border-b border-border/70">
            <CardTitle className="text-base">{t('items.wizard.itemTypeLabel')}</CardTitle>
            <CardDescription>Choose the asset or financial surface first so the rest of the form stays focused.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <FormFieldShell>
              <Label htmlFor="item-type" className={fieldLabelClassName}>
                {t('items.wizard.itemTypeLabel')} *
              </Label>
              <Select value={values.item_type} onValueChange={(value) => updateField('item_type', value as CreateItemType)}>
                <SelectTrigger id="item-type" aria-label={t('items.wizard.itemTypeLabel')} className={inputClassName('item_type')} aria-invalid={fieldErrors.item_type ? 'true' : 'false'}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FinancialItem">{t('items.wizard.itemTypeOptions.FinancialItem')}</SelectItem>
                  <SelectItem value="Vehicle">{t('items.wizard.itemTypeOptions.Vehicle')}</SelectItem>
                  <SelectItem value="RealEstate">{t('items.wizard.itemTypeOptions.RealEstate')}</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.item_type ? <p className={fieldErrorClassName}>{fieldErrors.item_type}</p> : null}
            </FormFieldShell>
          </CardContent>
        </Card>

        {isFinancial ? (
          <Card className="border border-border bg-card/95 shadow-sm shadow-black/5 dark:shadow-none">
            <CardHeader className="gap-2 border-b border-border/70">
              <CardTitle className="text-base">Financial item details</CardTitle>
              <CardDescription>Group core money fields, schedule details, and tracking context so recurring obligations stay readable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormFieldShell>
                  <Label htmlFor="financial-title" className={fieldLabelClassName}>{t('items.fields.name')} *</Label>
                  <Input id="financial-title" value={values.title} onChange={(event) => updateField('title', event.target.value)} className={inputClassName('title')} aria-invalid={fieldErrors.title ? 'true' : 'false'} />
                  {fieldErrors.title ? <p className={fieldErrorClassName}>{fieldErrors.title}</p> : null}
                </FormFieldShell>

                <FormFieldShell>
                  <Label htmlFor="financial-subtype" className={fieldLabelClassName}>{t('items.wizard.typeLabel')} *</Label>
                  <Select value={values.type} onValueChange={(value) => updateField('type', value as FinancialSubtype)}>
                    <SelectTrigger id="financial-subtype" aria-label="Financial subtype" className={inputClassName('type')} aria-invalid={fieldErrors.type ? 'true' : 'false'}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Commitment">Commitment</SelectItem>
                      <SelectItem value="Income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldErrors.type ? <p className={fieldErrorClassName}>{fieldErrors.type}</p> : null}
                </FormFieldShell>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FormFieldShell>
                  <Label htmlFor="financial-frequency" className={fieldLabelClassName}>{t('items.fields.billingCycle')} *</Label>
                  <Select value={values.frequency} onValueChange={(value) => updateField('frequency', value as FinancialFrequency)}>
                    <SelectTrigger id="financial-frequency" aria-label={t('items.fields.billingCycle')} className={inputClassName('frequency')} aria-invalid={fieldErrors.frequency ? 'true' : 'false'}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{FREQUENCY_LABELS[option]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.frequency ? <p className={fieldErrorClassName}>{fieldErrors.frequency}</p> : null}
                </FormFieldShell>

                <FormFieldShell>
                  <Label htmlFor="financial-amount" className={fieldLabelClassName}>{t('items.fields.amount')} *</Label>
                  <Input id="financial-amount" type="text" inputMode="decimal" value={formatCurrencyInput(values.default_amount)} onChange={(event) => updateField('default_amount', normalizeCurrencyInput(event.target.value))} className={inputClassName('default_amount')} aria-invalid={fieldErrors.default_amount ? 'true' : 'false'} />
                  {fieldErrors.default_amount ? <p className={fieldErrorClassName}>{fieldErrors.default_amount}</p> : null}
                </FormFieldShell>

                <FormFieldShell>
                  <Label htmlFor="financial-status" className={fieldLabelClassName}>Status *</Label>
                  <Select value={values.status} onValueChange={(value) => updateField('status', value as FinancialStatus)}>
                    <SelectTrigger id="financial-status" aria-label="Status" className={inputClassName('status')} aria-invalid={fieldErrors.status ? 'true' : 'false'}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldErrors.status ? <p className={fieldErrorClassName}>{fieldErrors.status}</p> : null}
                </FormFieldShell>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                {isRecurring ? `${t('items.fields.billingCycle')}: ${FREQUENCY_LABELS[values.frequency]}` : `${t('items.fields.billingCycle')}: ${FREQUENCY_LABELS.one_time}`}
              </div>

              {isRecurring ? (
                <section className="space-y-4 rounded-xl border border-border bg-background/70 p-4">
                  <label className="flex items-start gap-3 rounded-lg border border-border/70 bg-card/80 px-4 py-3">
                    <input type="checkbox" checked={values.dynamicTrackingEnabled} onChange={(event) => updateField('dynamicTrackingEnabled', event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">{t('items.wizard.dynamicTrackingLabel')}</span>
                      <span className={fieldHintClassName}>Keep running totals visible when this record repeats over time.</span>
                    </span>
                  </label>

                  {values.dynamicTrackingEnabled && values.type === 'Commitment' ? (
                    <FormFieldShell>
                      <Label htmlFor="starting-remaining" className={fieldLabelClassName}>{t('items.wizard.startingRemainingLabel')}</Label>
                      <Input id="starting-remaining" type="text" inputMode="decimal" value={formatCurrencyInput(values.trackingStartingRemainingBalance)} onChange={(event) => updateField('trackingStartingRemainingBalance', normalizeCurrencyInput(event.target.value))} className={inputClassName('trackingStartingRemainingBalance')} />
                      <p className={fieldHintClassName}>{t('items.wizard.startingRemainingHint')}</p>
                    </FormFieldShell>
                  ) : null}

                  {values.dynamicTrackingEnabled && values.type === 'Income' ? (
                    <FormFieldShell>
                      <Label htmlFor="starting-collected" className={fieldLabelClassName}>{t('items.wizard.startingCollectedLabel')}</Label>
                      <Input id="starting-collected" type="text" inputMode="decimal" value={formatCurrencyInput(values.trackingStartingCollectedTotal)} onChange={(event) => updateField('trackingStartingCollectedTotal', normalizeCurrencyInput(event.target.value))} className={inputClassName('trackingStartingCollectedTotal')} />
                      <p className={fieldHintClassName}>{t('items.wizard.startingCollectedHint')}</p>
                    </FormFieldShell>
                  ) : null}
                </section>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <FormFieldShell>
                  <Label htmlFor="financial-due-date" className={fieldLabelClassName}>{isRecurring ? t('items.fields.dueDate') : t('items.wizard.dueDateLabel')} *</Label>
                  <Input id="financial-due-date" type="date" value={values.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} className={inputClassName('dueDate')} aria-invalid={fieldErrors.dueDate ? 'true' : 'false'} />
                  {fieldErrors.dueDate ? <p className={fieldErrorClassName}>{fieldErrors.dueDate}</p> : null}
                </FormFieldShell>

                <FormFieldShell>
                  <Label htmlFor="linked-asset" className={fieldLabelClassName}>{t('items.wizard.parentOptionalLabel')}</Label>
                  <Select value={values.linked_asset_item_id || '__none__'} onValueChange={(value) => updateField('linked_asset_item_id', value === '__none__' ? '' : value)}>
                    <SelectTrigger id="linked-asset" aria-label={t('items.wizard.parentOptionalLabel')} className={inputClassName('linked_asset_item_id')} aria-invalid={fieldErrors.linked_asset_item_id ? 'true' : 'false'}>
                      <SelectValue placeholder={t('items.wizard.parentPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('items.wizard.parentPlaceholder')}</SelectItem>
                      {(assetsQuery.data?.items ?? []).map((asset) => (
                        <SelectItem key={asset.id} value={asset.id}>{getItemDisplayName(asset)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isCommitment ? <p className={fieldHintClassName}>{t('items.wizard.parentOptionalLabel')}</p> : null}
                  {fieldErrors.linked_asset_item_id ? <p className={fieldErrorClassName}>{fieldErrors.linked_asset_item_id}</p> : null}
                </FormFieldShell>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isVehicle ? (
          <Card className="border border-border bg-card/95 shadow-sm shadow-black/5 dark:shadow-none">
            <CardHeader className="gap-2 border-b border-border/70">
              <CardTitle className="text-base">Vehicle details</CardTitle>
              <CardDescription>Keep identifying and valuation fields close together for faster review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormFieldShell>
                  <Label htmlFor="vehicle-name" className={fieldLabelClassName}>{t('items.fields.name')}</Label>
                  <Input id="vehicle-name" value={values.title} onChange={(event) => updateField('title', event.target.value)} className={inputClassName('title')} />
                </FormFieldShell>
                <FormFieldShell>
                  <Label htmlFor="vehicle-vin" className={fieldLabelClassName}>{t('items.fields.vin')} *</Label>
                  <Input id="vehicle-vin" value={values.vin} onChange={(event) => updateField('vin', event.target.value)} className={inputClassName('vin')} aria-invalid={fieldErrors.vin ? 'true' : 'false'} />
                  {fieldErrors.vin ? <p className={fieldErrorClassName}>{fieldErrors.vin}</p> : null}
                </FormFieldShell>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FormFieldShell>
                  <Label htmlFor="vehicle-estimated-value" className={fieldLabelClassName}>{t('items.fields.estimatedValue')} *</Label>
                  <Input id="vehicle-estimated-value" type="text" inputMode="decimal" value={formatCurrencyInput(values.estimatedValue)} onChange={(event) => updateField('estimatedValue', normalizeCurrencyInput(event.target.value))} className={inputClassName('estimatedValue')} aria-invalid={fieldErrors.estimatedValue ? 'true' : 'false'} />
                  {fieldErrors.estimatedValue ? <p className={fieldErrorClassName}>{fieldErrors.estimatedValue}</p> : null}
                </FormFieldShell>
                <FormFieldShell>
                  <Label htmlFor="vehicle-make" className={fieldLabelClassName}>{t('items.fields.make')}</Label>
                  <Input id="vehicle-make" value={values.make} onChange={(event) => updateField('make', event.target.value)} className={inputClassName('item_type')} />
                </FormFieldShell>
                <FormFieldShell>
                  <Label htmlFor="vehicle-model" className={fieldLabelClassName}>{t('items.fields.model')}</Label>
                  <Input id="vehicle-model" value={values.model} onChange={(event) => updateField('model', event.target.value)} className={inputClassName('item_type')} />
                </FormFieldShell>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isRealEstate ? (
          <Card className="border border-border bg-card/95 shadow-sm shadow-black/5 dark:shadow-none">
            <CardHeader className="gap-2 border-b border-border/70">
              <CardTitle className="text-base">Property details</CardTitle>
              <CardDescription>Keep address and valuation details in one readable block for quick verification.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormFieldShell>
                  <Label htmlFor="property-name" className={fieldLabelClassName}>{t('items.fields.name')}</Label>
                  <Input id="property-name" value={values.title} onChange={(event) => updateField('title', event.target.value)} className={inputClassName('title')} />
                </FormFieldShell>
                <FormFieldShell>
                  <Label htmlFor="property-address" className={fieldLabelClassName}>{t('items.fields.address')} *</Label>
                  <Input id="property-address" value={values.address} onChange={(event) => updateField('address', event.target.value)} className={inputClassName('address')} aria-invalid={fieldErrors.address ? 'true' : 'false'} />
                  {fieldErrors.address ? <p className={fieldErrorClassName}>{fieldErrors.address}</p> : null}
                </FormFieldShell>
              </div>
              <FormFieldShell>
                <Label htmlFor="property-estimated-value" className={fieldLabelClassName}>{t('items.fields.estimatedValue')} *</Label>
                <Input id="property-estimated-value" type="text" inputMode="decimal" value={formatCurrencyInput(values.estimatedValue)} onChange={(event) => updateField('estimatedValue', normalizeCurrencyInput(event.target.value))} className={inputClassName('estimatedValue')} aria-invalid={fieldErrors.estimatedValue ? 'true' : 'false'} />
                {fieldErrors.estimatedValue ? <p className={fieldErrorClassName}>{fieldErrors.estimatedValue}</p> : null}
              </FormFieldShell>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border border-border bg-card/95 shadow-sm shadow-black/5 dark:shadow-none">
          <CardHeader className="gap-2 border-b border-border/70">
            <CardTitle className="text-base">Notes and review</CardTitle>
            <CardDescription>Capture context and validate the payload before you submit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <FormFieldShell>
              <Label htmlFor="item-description" className={fieldLabelClassName}>{t('items.fields.description')}</Label>
              <Textarea id="item-description" rows={3} value={values.description} onChange={(event) => updateField('description', event.target.value)} className="min-h-24 bg-background/90 px-3 py-2 text-sm" />
            </FormFieldShell>

            <div className="space-y-3">
              <p className={fieldLabelClassName}>{t('items.wizard.reviewLabel')}</p>
              <div className="rounded-xl border border-border bg-background/70 px-4 py-1">
                {reviewRows.map((row) => (
                  <ReviewRow key={row.label} label={row.label} value={row.value} />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Button type="button" variant="outline" className="w-full justify-between sm:w-auto" onClick={() => setShowTechnicalReview((value) => !value)}>
                {showTechnicalReview ? t('items.wizard.hideTechnicalReview') : t('items.wizard.showTechnicalReview')}
              </Button>

              <div className="ui-expand" data-open={showTechnicalReview}>
                {showTechnicalReview ? <Textarea value={technicalSummary} readOnly rows={12} className="min-h-56 bg-background px-3 py-3 font-mono text-sm" /> : null}
              </div>
            </div>

            {errorText ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{errorText}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={createMutation.isPending} className="hover-lift px-4">
                {createMutation.isPending ? t('items.wizard.creating') : createLabel}
              </Button>
              <Button asChild type="button" variant="outline" className="hover-lift px-4">
                <Link to="/items">{t('items.wizard.cancelAction')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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
