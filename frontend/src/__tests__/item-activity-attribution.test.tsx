// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { apiRequest } from '../lib/api-client'
import '../lib/i18n'
import { ItemActivityTimeline } from '../features/audit/item-activity-timeline'

function createJsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

describe('item activity attribution transport', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  function renderTimeline() {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    return render(
      <QueryClientProvider client={client}>
        <ItemActivityTimeline itemId="item-1" />
      </QueryClientProvider>,
    )
  }

  it('preserves actor and lens tuple fields from activity payloads', async () => {
    globalThis.fetch = vi.fn(async () =>
      createJsonResponse(200, {
        item_id: 'item-1',
        activity: [
          {
            id: 'audit-1',
            user_id: 'legacy-user',
            actor_user_id: 'admin-1',
            actor_label: 'Admin User',
            lens_user_id: 'owner-1',
            lens_label: 'Owner Lens',
            lens_attribution_state: 'attributed',
            action: 'item.updated',
            entity: 'item:item-1',
            entity_type: 'item',
            entity_id: 'item-1',
            timestamp: '2026-02-26T10:10:10.000Z',
            event_type: null,
            event_status: null,
            event_due_date: null,
            event_amount: null,
            event_completed_at: null,
          },
        ],
      }),
    ) as typeof fetch

    const result = await apiRequest<{
      item_id: string
      activity: Array<{ actor_user_id: string | null; lens_user_id: string | null; lens_attribution_state: string }>
    }>('/items/item-1/activity?limit=25')

    expect(result.activity[0]).toMatchObject({
      actor_user_id: 'admin-1',
      lens_user_id: 'owner-1',
      lens_attribution_state: 'attributed',
    })
  })

  it('keeps legacy rows deterministic when lens attribution is missing', async () => {
    globalThis.fetch = vi.fn(async () =>
      createJsonResponse(200, {
        item_id: 'item-1',
        activity: [
          {
            id: 'audit-legacy',
            user_id: 'owner-legacy',
            actor_user_id: null,
            actor_label: null,
            lens_user_id: null,
            lens_label: null,
            lens_attribution_state: 'legacy_missing',
            action: 'item.restored',
            entity: 'item:item-1',
            entity_type: 'item',
            entity_id: 'item-1',
            timestamp: '2026-02-26T10:10:10.000Z',
            event_type: null,
            event_status: null,
            event_due_date: null,
            event_amount: null,
            event_completed_at: null,
          },
        ],
      }),
    ) as typeof fetch

    const result = await apiRequest<{
      activity: Array<{ actor_user_id: string | null; lens_user_id: string | null; lens_attribution_state: string; user_id: string }>
    }>('/items/item-1/activity?limit=25')

    expect(result.activity[0].actor_user_id).toBeNull()
    expect(result.activity[0].user_id).toBe('owner-legacy')
    expect(result.activity[0].lens_user_id).toBeNull()
    expect(result.activity[0].lens_attribution_state).toBe('legacy_missing')
  })

  it('renders export outcomes and attribution tuples with readable labels and stable IDs', async () => {
    globalThis.fetch = vi.fn(async () =>
      createJsonResponse(200, {
        item_id: 'item-1',
        activity: [
          {
            id: 'audit-1',
            user_id: 'legacy-user',
            actor_user_id: 'admin-1',
            actor_label: 'Admin User',
            lens_user_id: 'owner-1',
            lens_label: 'Owner Lens',
            lens_attribution_state: 'attributed',
            action: 'item.updated',
            entity: 'item:item-1',
            entity_type: 'item',
            entity_id: 'item-1',
            timestamp: '2026-02-26T10:10:10.000Z',
            event_type: null,
            event_status: null,
            event_due_date: null,
            event_amount: null,
            event_completed_at: null,
          },
          {
            id: 'audit-2',
            user_id: 'owner-legacy',
            actor_user_id: null,
            actor_label: null,
            lens_user_id: null,
            lens_label: null,
            lens_attribution_state: 'legacy_missing',
            action: 'item.restored',
            entity: 'item:item-1',
            entity_type: 'item',
            entity_id: 'item-1',
            timestamp: '2026-02-26T11:11:11.000Z',
            event_type: null,
            event_status: null,
            event_due_date: null,
            event_amount: null,
            event_completed_at: null,
          },
          {
            id: 'audit-3',
            user_id: 'admin-1',
            actor_user_id: 'admin-1',
            actor_label: 'Admin User',
            lens_user_id: null,
            lens_label: 'All users',
            lens_attribution_state: 'all_data',
            action: 'export.backup.failed',
            entity: 'export:backup.xlsx',
            entity_type: 'export',
            entity_id: 'backup.xlsx',
            timestamp: '2026-02-26T12:11:11.000Z',
            event_type: null,
            event_status: null,
            event_due_date: null,
            event_amount: null,
            event_completed_at: null,
          },
        ],
      }),
    ) as typeof fetch

    renderTimeline()

    expect(await screen.findByText('Actor: Admin User | Lens: Owner Lens')).toBeTruthy()
    expect(await screen.findByText('Actor: Admin User | Lens: All users')).toBeTruthy()
    expect(await screen.findByText('Actor: owner-legacy | Lens: Legacy row (lens unavailable)')).toBeTruthy()
    expect(await screen.findByText('Export backup failed')).toBeTruthy()
    expect(
      await screen.findByText((text) => text.startsWith('Export outcome: Failed -')),
    ).toBeTruthy()
    expect(await screen.findByText('Actor ID: admin-1 | Lens ID: null (all-data)')).toBeTruthy()
    expect(await screen.findByText('Item restored')).toBeTruthy()
  })
})
