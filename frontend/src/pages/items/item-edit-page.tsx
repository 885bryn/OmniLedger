import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { TargetUserChip, resolveTargetUserAttribution } from '../../features/admin-scope/target-user-chip'
import { ConfirmationDialog } from '../../features/ui/confirmation-dialog'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { getItemDisplayName } from '../../lib/item-display'
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
    const parsed = Number(raw)
    output[key] = Number.isFinite(parsed) ? parsed : initialValue
  }

  return output
}

export function ItemEditPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { isAdmin, mode, lensUserId, users } = useAdminScope()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams<{ itemId: string }>()
  const itemId = params.itemId || ''

  const [initialAttributes, setInitialAttributes] = useState<Record<string, unknown>>({})
  const [draftAttributes, setDraftAttributes] = useState<Record<string, unknown>>({})
  const [showTechnical, setShowTechnical] = useState(false)
  const [newFieldKey, setNewFieldKey] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)

  const itemQuery = useQuery({
    queryKey: queryKeys.items.list({ scope: 'edit', itemId }),
    enabled: Boolean(itemId),
    queryFn: async () => {
      const response = await apiRequest<ItemsResponse>('/items?include_deleted=true')
      return response.items.find((item) => item.id === itemId) ?? null
    },
  })

  const hasUnsavedChanges = useMemo(() => JSON.stringify(draftAttributes) !== JSON.stringify(initialAttributes), [draftAttributes, initialAttributes])

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
  }, [itemQuery.data])

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = convertForSave(draftAttributes, initialAttributes)

      return apiRequest<ItemRow>(`/items/${itemId}`, {
        method: 'PATCH',
        body: { attributes: payload },
      })
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
      unsavedGuard.allowNextNavigation()
      navigate(`/items/${itemId}`)
    },
  })

  const editableEntries = useMemo(
    () =>
      Object.entries(draftAttributes)
        .filter(([key, value]) => !key.startsWith('_') && isEditablePrimitive(value))
        .sort(([a], [b]) => a.localeCompare(b)),
    [draftAttributes],
  )

  const errorText = useMemo(() => {
    if (updateMutation.error instanceof ApiClientError) {
      return updateMutation.error.message
    }

    if (updateMutation.isError) {
      return t('items.edit.saveError')
    }

    return fieldError
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
          setSaveConfirmOpen(true)
        }}
        className="animate-fade-up space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {editableEntries.map(([key, value]) => {
            const initialValue = initialAttributes[key]
            const isDescription = key.toLowerCase().includes('description')
            const isDate = key.toLowerCase().includes('date')
            const isNumber = typeof initialValue === 'number'
            const isBoolean = typeof initialValue === 'boolean'

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

        {showTechnical ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.edit.technicalSnapshot')}</p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs">{JSON.stringify(draftAttributes, null, 2)}</pre>
          </div>
        ) : null}

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
