import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { useUnsavedChangesGuard } from '../../features/items/use-unsaved-changes-guard'
import { queryKeys } from '../../lib/query-keys'

type ItemRow = {
  id: string
  item_type: string
  attributes: Record<string, unknown>
}

type ItemsResponse = {
  items: ItemRow[]
}

type EditFormValues = {
  attributesJson: string
}

export function ItemEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams<{ itemId: string }>()
  const itemId = params.itemId || ''

  const form = useForm<EditFormValues>({
    defaultValues: {
      attributesJson: '{}',
    },
  })

  const itemQuery = useQuery({
    queryKey: queryKeys.items.list({ scope: 'edit', itemId }),
    enabled: Boolean(itemId),
    queryFn: async () => {
      const response = await apiRequest<ItemsResponse>('/items?include_deleted=true')
      return response.items.find((item) => item.id === itemId) ?? null
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      const raw = form.getValues('attributesJson')
      let attributes: Record<string, unknown>

      try {
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('invalid_json')
        }
        attributes = parsed
      } catch {
        form.setError('attributesJson', {
          type: 'validate',
          message: t('items.edit.invalidJson'),
        })
        throw new Error('invalid_json')
      }

      return apiRequest<ItemRow>(`/items/${itemId}`, {
        method: 'PATCH',
        body: { attributes },
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(itemId) }),
      ])

      form.reset(form.getValues())
      navigate(`/items/${itemId}`)
    },
  })

  const errorText = useMemo(() => {
    if (updateMutation.error instanceof ApiClientError) {
      return updateMutation.error.message
    }

    if (updateMutation.isError) {
      return t('items.edit.saveError')
    }

    return null
  }, [t, updateMutation.error, updateMutation.isError])

  useUnsavedChangesGuard(form.formState.isDirty, t('items.form.unsavedWarning'))

  useEffect(() => {
    if (!itemQuery.data) {
      return
    }

    form.reset({ attributesJson: JSON.stringify(itemQuery.data.attributes, null, 2) })
  }, [form, itemQuery.data])

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
      <header className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t('items.edit.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{currentItem.item_type}</p>
      </header>

      <form
        onSubmit={form.handleSubmit(() => {
          updateMutation.mutate()
        })}
        className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.edit.attributesLabel')}</span>
          <textarea
            rows={14}
            {...form.register('attributesJson')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
          />
        </label>

        {form.formState.errors.attributesJson ? (
          <p className="text-xs text-destructive">{form.formState.errors.attributesJson.message}</p>
        ) : null}
        {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updateMutation.isPending ? t('items.edit.saving') : t('items.edit.saveAction')}
          </button>
          <Link to={`/items/${itemId}`} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
            {t('items.edit.cancelAction')}
          </Link>
        </div>
      </form>
    </section>
  )
}
