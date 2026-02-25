import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ApiClientError, apiRequest, getActiveActorUserId } from '../../lib/api-client'
import { useUnsavedChangesGuard } from '../../features/items/use-unsaved-changes-guard'
import { queryKeys } from '../../lib/query-keys'

type ItemType = 'RealEstate' | 'Vehicle' | 'FinancialCommitment' | 'Subscription'

type ItemRow = {
  id: string
  item_type: ItemType
  attributes: Record<string, unknown>
}

type ItemsResponse = {
  items: ItemRow[]
}

type WizardFormValues = {
  item_type: ItemType
  parent_item_id: string
  address: string
  vin: string
  estimatedValue: string
  amount: string
  dueDate: string
  billingCycle: string
}

const ITEM_TYPES: ItemType[] = ['RealEstate', 'Vehicle', 'FinancialCommitment', 'Subscription']

function buildAttributes(values: WizardFormValues) {
  if (values.item_type === 'RealEstate') {
    return {
      address: values.address,
      estimatedValue: Number(values.estimatedValue),
    }
  }

  if (values.item_type === 'Vehicle') {
    return {
      vin: values.vin,
      estimatedValue: Number(values.estimatedValue),
    }
  }

  if (values.item_type === 'FinancialCommitment') {
    return {
      amount: Number(values.amount),
      dueDate: values.dueDate,
    }
  }

  return {
    amount: Number(values.amount),
    billingCycle: values.billingCycle,
  }
}

function itemLabel(item: ItemRow) {
  if (typeof item.attributes?.address === 'string' && item.attributes.address.trim().length > 0) {
    return item.attributes.address
  }

  if (typeof item.attributes?.vin === 'string' && item.attributes.vin.trim().length > 0) {
    return item.attributes.vin
  }

  return item.item_type
}

export function ItemCreateWizardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)

  const form = useForm<WizardFormValues>({
    defaultValues: {
      item_type: 'RealEstate',
      parent_item_id: '',
      address: '',
      vin: '',
      estimatedValue: '0',
      amount: '0',
      dueDate: '',
      billingCycle: 'monthly',
    },
  })

  const selectedType = form.watch('item_type')
  const watchedValues = form.watch()

  const assetsQuery = useQuery({
    queryKey: queryKeys.items.list({ filter: 'assets', sort: 'recently_updated' }),
    queryFn: async () => apiRequest<ItemsResponse>('/items?filter=assets&sort=recently_updated'),
  })

  const actorUserId = getActiveActorUserId()

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!actorUserId) {
        throw new Error('missing_actor')
      }

      const values = form.getValues()
      if (values.item_type === 'FinancialCommitment' && !values.parent_item_id) {
        form.setError('parent_item_id', {
          type: 'required',
          message: t('items.wizard.parentRequired'),
        })
        throw new Error('parent_required')
      }

      return apiRequest<ItemRow>('/items', {
        method: 'POST',
        body: {
          user_id: actorUserId,
          item_type: values.item_type,
          parent_item_id: values.item_type === 'FinancialCommitment' ? values.parent_item_id : null,
          attributes: buildAttributes(values),
        },
      })
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.items.all })
      form.reset()
      navigate(`/items/${created.id}`)
    },
  })

  const summary = useMemo(() => {
    return JSON.stringify(
      {
        item_type: watchedValues.item_type,
        parent_item_id: watchedValues.parent_item_id || null,
        attributes: buildAttributes(watchedValues as WizardFormValues),
      },
      null,
      2,
    )
  }, [watchedValues])

  const errorText = useMemo(() => {
    if (createMutation.error instanceof ApiClientError) {
      return createMutation.error.message
    }

    if (createMutation.error instanceof Error && createMutation.error.message === 'missing_actor') {
      return t('items.wizard.actorMissing')
    }

    if (createMutation.isError) {
      return t('items.wizard.createError')
    }

    return null
  }, [createMutation.error, createMutation.isError, t])

  useUnsavedChangesGuard(form.formState.isDirty, t('items.form.unsavedWarning'))

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t('items.wizard.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('items.wizard.stepLabel', { step })}</p>
      </header>

      <form
        onSubmit={form.handleSubmit(() => {
          if (step < 3) {
            setStep((current) => current + 1)
            return
          }

          createMutation.mutate()
        })}
        className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        {step === 1 ? (
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.typeLabel')}</span>
            <select {...form.register('item_type')} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
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
            {(selectedType === 'RealEstate' || selectedType === 'Vehicle') && (
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {selectedType === 'RealEstate' ? t('items.wizard.addressLabel') : t('items.wizard.vinLabel')}
                </span>
                <input
                  {...form.register(selectedType === 'RealEstate' ? 'address' : 'vin', { required: true })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            )}

            {(selectedType === 'RealEstate' || selectedType === 'Vehicle') && (
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.estimatedValueLabel')}</span>
                <input
                  type="number"
                  step="1"
                  {...form.register('estimatedValue', { required: true })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            )}

            {(selectedType === 'FinancialCommitment' || selectedType === 'Subscription') && (
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.amountLabel')}</span>
                <input
                  type="number"
                  step="1"
                  {...form.register('amount', { required: true })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            )}

            {selectedType === 'FinancialCommitment' && (
              <>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.parentLabel')}</span>
                  <select {...form.register('parent_item_id')} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">{t('items.wizard.parentPlaceholder')}</option>
                    {(assetsQuery.data?.items ?? []).map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {itemLabel(asset)}
                      </option>
                    ))}
                  </select>
                </label>
                {form.formState.errors.parent_item_id ? (
                  <p className="text-xs text-destructive">{form.formState.errors.parent_item_id.message}</p>
                ) : null}

                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.dueDateLabel')}</span>
                  <input
                    type="date"
                    {...form.register('dueDate', { required: true })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              </>
            )}

            {selectedType === 'Subscription' && (
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.billingCycleLabel')}</span>
                <input {...form.register('billingCycle', { required: true })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.wizard.reviewLabel')}</span>
            <textarea value={summary} readOnly rows={12} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm" />
          </label>
        ) : null}

        {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}

        <div className="flex flex-wrap gap-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
            >
              {t('items.wizard.backAction')}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {step < 3 ? t('items.wizard.nextAction') : createMutation.isPending ? t('items.wizard.creating') : t('items.wizard.createAction')}
          </button>
          <Link to="/items" className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
            {t('items.wizard.cancelAction')}
          </Link>
        </div>
      </form>
    </section>
  )
}
