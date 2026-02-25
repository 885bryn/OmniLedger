import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ConfirmationDialog } from '../../features/ui/confirmation-dialog'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { getItemDisplayName } from '../../lib/item-display'
import { useUnsavedChangesGuard } from '../../features/items/use-unsaved-changes-guard'
import { queryKeys } from '../../lib/query-keys'

type ItemType = 'RealEstate' | 'Vehicle' | 'FinancialCommitment' | 'FinancialIncome'

type ItemRow = {
  id: string
  item_type: ItemType
  attributes: Record<string, unknown>
}

type ItemsResponse = {
  items: ItemRow[]
}

type CustomField = {
  key: string
  value: string
}

type WizardFormValues = {
  item_type: ItemType
  parent_item_id: string
  name: string
  description: string
  address: string
  city: string
  province: string
  postalCode: string
  occupancy: string
  vin: string
  make: string
  model: string
  year: string
  lender: string
  estimatedValue: string
  monthlyRent: string
  amount: string
  dueDate: string
  billingCycle: string
  interestRate: string
  originalPrincipal: string
  remainingBalance: string
  nextPaymentAmount: string
}

const ITEM_TYPES: ItemType[] = ['RealEstate', 'Vehicle', 'FinancialCommitment', 'FinancialIncome']

const DEFAULT_VALUES: WizardFormValues = {
  item_type: 'RealEstate',
  parent_item_id: '',
  name: '',
  description: '',
  address: '',
  city: '',
  province: '',
  postalCode: '',
  occupancy: '',
  vin: '',
  make: '',
  model: '',
  year: '',
  lender: '',
  estimatedValue: '',
  monthlyRent: '',
  amount: '',
  dueDate: '',
  billingCycle: 'monthly',
  interestRate: '',
  originalPrincipal: '',
  remainingBalance: '',
  nextPaymentAmount: '',
}

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mergeCustomFields(customFields: CustomField[]) {
  return customFields.reduce<Record<string, unknown>>((output, field) => {
    const key = field.key.trim()
    if (!key) {
      return output
    }

    output[key] = field.value
    return output
  }, {})
}

function buildAttributes(values: WizardFormValues, customFields: CustomField[]) {
  const custom = mergeCustomFields(customFields)

  if (values.item_type === 'RealEstate') {
    return {
      address: values.address,
      city: values.city,
      province: values.province,
      postalCode: values.postalCode,
      occupancy: values.occupancy,
      description: values.description,
      estimatedValue: toNumber(values.estimatedValue),
      monthlyRent: values.monthlyRent ? toNumber(values.monthlyRent) : undefined,
      ...custom,
    }
  }

  if (values.item_type === 'Vehicle') {
    return {
      vin: values.vin,
      make: values.make,
      model: values.model,
      year: values.year ? toNumber(values.year) : undefined,
      description: values.description,
      estimatedValue: toNumber(values.estimatedValue),
      ...custom,
    }
  }

  if (values.item_type === 'FinancialCommitment') {
    return {
      name: values.name,
      description: values.description,
      lender: values.lender,
      amount: toNumber(values.amount),
      dueDate: values.dueDate,
      interestRate: values.interestRate ? toNumber(values.interestRate) : undefined,
      originalPrincipal: values.originalPrincipal ? toNumber(values.originalPrincipal) : undefined,
      remainingBalance: values.remainingBalance ? toNumber(values.remainingBalance) : undefined,
      nextPaymentAmount: values.nextPaymentAmount ? toNumber(values.nextPaymentAmount) : undefined,
      ...custom,
    }
  }

  return {
    name: values.name,
    description: values.description,
    amount: toNumber(values.amount),
    dueDate: values.dueDate || undefined,
    billingCycle: values.billingCycle,
    collectedTotal: values.item_type === 'FinancialIncome' ? 0 : undefined,
    ...custom,
  }
}

function requiredFieldsForType(type: ItemType) {
  if (type === 'RealEstate') {
    return ['address', 'estimatedValue']
  }

  if (type === 'Vehicle') {
    return ['vin', 'make', 'model', 'year', 'estimatedValue']
  }

  if (type === 'FinancialCommitment') {
    return ['name', 'amount', 'dueDate']
  }

  return ['name', 'amount', 'dueDate']
}

export function ItemCreateWizardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [values, setValues] = useState<WizardFormValues>(DEFAULT_VALUES)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [newCustomKey, setNewCustomKey] = useState('')
  const [newCustomValue, setNewCustomValue] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [missingRequiredFields, setMissingRequiredFields] = useState<string[]>([])
  const [showTechnicalReview, setShowTechnicalReview] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [suppressUnsavedGuard, setSuppressUnsavedGuard] = useState(false)

  const selectedType = values.item_type

  const assetsQuery = useQuery({
    queryKey: queryKeys.items.list({ filter: 'assets', sort: 'recently_updated' }),
    queryFn: async () => apiRequest<ItemsResponse>('/items?filter=assets&sort=recently_updated'),
  })

  useEffect(() => {
    const typeParam = searchParams.get('item_type')
    const parentParam = searchParams.get('parent_item_id')

    setValues((current) => ({
      ...current,
      item_type: typeParam && ITEM_TYPES.includes(typeParam as ItemType) ? (typeParam as ItemType) : current.item_type,
      parent_item_id: parentParam ?? current.parent_item_id,
    }))
  }, [searchParams])

  const reviewRows = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [{ label: t('items.wizard.typeLabel'), value: values.item_type }]

    if (values.item_type === 'RealEstate') {
      rows.push({ label: t('items.fields.address'), value: values.address || '-' })
      rows.push({ label: t('items.fields.city'), value: values.city || '-' })
      rows.push({ label: t('items.fields.province'), value: values.province || '-' })
      rows.push({ label: t('items.fields.postalCode'), value: values.postalCode || '-' })
      rows.push({ label: t('items.fields.estimatedValue'), value: values.estimatedValue || '-' })
    }

    if (values.item_type === 'Vehicle') {
      rows.push({ label: t('items.fields.make'), value: values.make || '-' })
      rows.push({ label: t('items.fields.model'), value: values.model || '-' })
      rows.push({ label: t('items.fields.year'), value: values.year || '-' })
      rows.push({ label: t('items.fields.vin'), value: values.vin || '-' })
      rows.push({ label: t('items.fields.estimatedValue'), value: values.estimatedValue || '-' })
    }

    if (values.item_type === 'FinancialCommitment' || values.item_type === 'FinancialIncome') {
      rows.push({ label: t('items.fields.name'), value: values.name || '-' })
      rows.push({ label: t('items.fields.amount'), value: values.amount || '-' })
      if (values.dueDate) {
        rows.push({ label: t('items.fields.dueDate'), value: values.dueDate })
      }
    }

    if (values.item_type === 'FinancialCommitment') {
      const parent = (assetsQuery.data?.items ?? []).find((item) => item.id === values.parent_item_id)
      rows.push({ label: t('items.fields.parentAsset'), value: parent ? getItemDisplayName(parent) : '-' })
      rows.push({ label: t('items.fields.remainingBalance'), value: values.remainingBalance || '-' })
      rows.push({ label: t('items.fields.nextPaymentAmount'), value: values.nextPaymentAmount || '-' })
    }

    return rows
  }, [assetsQuery.data?.items, t, values])

  const technicalSummary = useMemo(
    () =>
      JSON.stringify(
        {
          item_type: values.item_type,
          parent_item_id: values.parent_item_id || null,
          attributes: buildAttributes(values, customFields),
        },
        null,
        2,
      ),
    [customFields, values],
  )

  const createMutation = useMutation({
    mutationFn: async () => {
      const attributes = buildAttributes(values, customFields)

      const created = await apiRequest<ItemRow>('/items', {
        method: 'POST',
        body: {
          item_type: values.item_type,
          parent_item_id: values.parent_item_id || null,
          attributes,
        },
      })

      return {
        created,
        attributes,
      }
    },
    onSuccess: async ({ created, attributes }) => {
      if (created.item_type === 'FinancialCommitment' || created.item_type === 'FinancialIncome') {
        await apiRequest(`/items/${created.id}`, {
          method: 'PATCH',
          body: { attributes },
        })
      }

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

    return fieldError
  }, [createMutation.error, createMutation.isError, fieldError, t])

  const unsavedGuard = useUnsavedChangesGuard(dirty && !suppressUnsavedGuard)

  const inputClassName = (fieldKey?: keyof WizardFormValues) => {
    const missing = fieldKey ? missingRequiredFields.includes(fieldKey) : false
    return `w-full rounded-lg border bg-background px-3 py-2 text-sm ${missing ? 'border-destructive ring-1 ring-destructive/30' : 'border-border'}`
  }

  function updateField<K extends keyof WizardFormValues>(key: K, value: WizardFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setSuppressUnsavedGuard(false)
    setDirty(true)
    setFieldError(null)
    setMissingRequiredFields((current) => current.filter((field) => field !== key))
  }

  function getMissingRequiredFields() {
    const required = requiredFieldsForType(selectedType)
    return required.filter((key) => {
      const value = values[key as keyof WizardFormValues]
      return typeof value !== 'string' || value.trim() === ''
    })
  }

  function canContinueStep2() {
    return getMissingRequiredFields().length === 0
  }

  function handleAddCustomField() {
    const key = newCustomKey.trim()
    if (!key) {
      setFieldError(t('items.wizard.customFieldNameRequired'))
      return
    }

    if (Object.prototype.hasOwnProperty.call(values, key) || customFields.some((field) => field.key.toLowerCase() === key.toLowerCase())) {
      setFieldError(t('items.wizard.customFieldExists'))
      return
    }

    setCustomFields((current) => [...current, { key, value: newCustomValue }])
    setNewCustomKey('')
    setNewCustomValue('')
    setSuppressUnsavedGuard(false)
    setFieldError(null)
    setDirty(true)
  }

  return (
    <section className="space-y-4">
      <header className="animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t('items.wizard.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('items.wizard.stepLabel', { step })}</p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault()

          if (step < 3) {
            if (step === 2 && !canContinueStep2()) {
              setMissingRequiredFields(getMissingRequiredFields())
              setFieldError(t('items.wizard.requiredMissing'))
              return
            }

            setStep((current) => current + 1)
            return
          }

          setSuppressUnsavedGuard(true)
          createMutation.mutate()
        }}
        className="animate-fade-up space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        {step === 1 ? (
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.typeLabel')}</span>
            <select value={values.item_type} onChange={(event) => updateField('item_type', event.target.value as ItemType)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {ITEM_TYPES.map((itemType) => (
                <option key={itemType} value={itemType}>
                  {itemType}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            {selectedType === 'RealEstate' ? (
              <>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.address')} *</span>
                  <input value={values.address} onChange={(event) => updateField('address', event.target.value)} className={inputClassName('address')} />
                  {missingRequiredFields.includes('address') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                </label>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.city')}</span>
                    <input value={values.city} onChange={(event) => updateField('city', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.province')}</span>
                    <input value={values.province} onChange={(event) => updateField('province', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.postalCode')}</span>
                    <input value={values.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.estimatedValue')} *</span>
                    <input type="number" value={values.estimatedValue} onChange={(event) => updateField('estimatedValue', event.target.value)} className={inputClassName('estimatedValue')} />
                    {missingRequiredFields.includes('estimatedValue') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.monthlyRent')}</span>
                    <input type="number" value={values.monthlyRent} onChange={(event) => updateField('monthlyRent', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                </div>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.description')}</span>
                  <textarea rows={2} value={values.description} onChange={(event) => updateField('description', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </label>
              </>
            ) : null}

            {selectedType === 'Vehicle' ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.year')} *</span>
                    <input type="number" value={values.year} onChange={(event) => updateField('year', event.target.value)} className={inputClassName('year')} />
                    {missingRequiredFields.includes('year') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.make')} *</span>
                    <input value={values.make} onChange={(event) => updateField('make', event.target.value)} className={inputClassName('make')} />
                    {missingRequiredFields.includes('make') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.model')} *</span>
                    <input value={values.model} onChange={(event) => updateField('model', event.target.value)} className={inputClassName('model')} />
                    {missingRequiredFields.includes('model') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                  </label>
                </div>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.vin')} *</span>
                  <input value={values.vin} onChange={(event) => updateField('vin', event.target.value)} className={inputClassName('vin')} />
                  {missingRequiredFields.includes('vin') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.estimatedValue')} *</span>
                  <input type="number" value={values.estimatedValue} onChange={(event) => updateField('estimatedValue', event.target.value)} className={inputClassName('estimatedValue')} />
                  {missingRequiredFields.includes('estimatedValue') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.description')}</span>
                  <textarea rows={2} value={values.description} onChange={(event) => updateField('description', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </label>
              </>
            ) : null}

            {selectedType === 'FinancialCommitment' ? (
              <>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.name')} *</span>
                  <input value={values.name} onChange={(event) => updateField('name', event.target.value)} className={inputClassName('name')} />
                  {missingRequiredFields.includes('name') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.parentOptionalLabel')}</span>
                  <select value={values.parent_item_id} onChange={(event) => updateField('parent_item_id', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">{t('items.wizard.parentPlaceholder')}</option>
                    {(assetsQuery.data?.items ?? []).map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {getItemDisplayName(asset)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.amount')} *</span>
                    <input type="number" value={values.amount} onChange={(event) => updateField('amount', event.target.value)} className={inputClassName('amount')} />
                    {missingRequiredFields.includes('amount') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.dueDate')} *</span>
                    <input type="date" value={values.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} className={inputClassName('dueDate')} />
                    {missingRequiredFields.includes('dueDate') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.lender')}</span>
                    <input value={values.lender} onChange={(event) => updateField('lender', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.interestRate')}</span>
                    <input type="number" step="0.01" value={values.interestRate} onChange={(event) => updateField('interestRate', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.originalPrincipal')}</span>
                    <input type="number" value={values.originalPrincipal} onChange={(event) => updateField('originalPrincipal', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.remainingBalance')}</span>
                    <input type="number" value={values.remainingBalance} onChange={(event) => updateField('remainingBalance', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.nextPaymentAmount')}</span>
                    <input type="number" value={values.nextPaymentAmount} onChange={(event) => updateField('nextPaymentAmount', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                </div>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.description')}</span>
                  <textarea rows={2} value={values.description} onChange={(event) => updateField('description', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </label>
              </>
            ) : null}

            {selectedType === 'FinancialIncome' ? (
              <>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.name')} *</span>
                  <input value={values.name} onChange={(event) => updateField('name', event.target.value)} className={inputClassName('name')} />
                  {missingRequiredFields.includes('name') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.parentOptionalLabel')}</span>
                  <select value={values.parent_item_id} onChange={(event) => updateField('parent_item_id', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">{t('items.wizard.parentPlaceholder')}</option>
                    {(assetsQuery.data?.items ?? []).map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {getItemDisplayName(asset)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.amount')} *</span>
                    <input type="number" value={values.amount} onChange={(event) => updateField('amount', event.target.value)} className={inputClassName('amount')} />
                    {missingRequiredFields.includes('amount') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.dueDate')} *</span>
                    <input type="date" value={values.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} className={inputClassName('dueDate')} />
                    {missingRequiredFields.includes('dueDate') ? <p className="text-xs text-destructive">{t('items.wizard.fieldRequired')}</p> : null}
                  </label>
                </div>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.billingCycle')}</span>
                  <input value={values.billingCycle} onChange={(event) => updateField('billingCycle', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.fields.description')}</span>
                  <textarea rows={2} value={values.description} onChange={(event) => updateField('description', event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </label>
              </>
            ) : null}

            <section className="rounded-xl border border-border bg-background/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.customFieldsTitle')}</p>
              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  value={newCustomKey}
                  onChange={(event) => setNewCustomKey(event.target.value)}
                  placeholder={t('items.wizard.customFieldNamePlaceholder')}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  value={newCustomValue}
                  onChange={(event) => setNewCustomValue(event.target.value)}
                  placeholder={t('items.wizard.customFieldValuePlaceholder')}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button type="button" onClick={handleAddCustomField} className="hover-lift rounded-lg border border-border px-3 py-2 text-sm font-medium">
                  {t('items.wizard.addCustomField')}
                </button>
              </div>

              {customFields.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {customFields.map((field, index) => (
                    <li key={`${field.key}-${index}`} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <span>
                        {field.key}: {field.value}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomFields((current) => current.filter((_, currentIndex) => currentIndex !== index))
                          setSuppressUnsavedGuard(false)
                          setDirty(true)
                        }}
                        className="text-xs text-destructive"
                      >
                        {t('items.wizard.removeCustomField')}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        ) : null}

        {step === 3 ? (
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

            {showTechnicalReview ? <textarea value={technicalSummary} readOnly rows={12} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm" /> : null}
          </div>
        ) : null}

        {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}

        <div className="flex flex-wrap gap-2">
          {step > 1 ? (
            <button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} className="hover-lift rounded-lg border border-border px-4 py-2 text-sm font-medium">
              {t('items.wizard.backAction')}
            </button>
          ) : null}
          <button type="submit" disabled={createMutation.isPending} className="hover-lift rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
            {step < 3 ? t('items.wizard.nextAction') : createMutation.isPending ? t('items.wizard.creating') : t('items.wizard.createAction')}
          </button>
          <Link to="/items" className="hover-lift rounded-lg border border-border px-4 py-2 text-sm font-medium">
            {t('items.wizard.cancelAction')}
          </Link>
        </div>
      </form>

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
