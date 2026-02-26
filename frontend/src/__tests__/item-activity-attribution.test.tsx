// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../lib/api-client'

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
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('preserves actor and lens tuple fields from activity payloads', async () => {
    globalThis.fetch = vi.fn(async () =>
      createJsonResponse(200, {
        item_id: 'item-1',
        activity: [
          {
            id: 'audit-1',
            user_id: 'legacy-user',
            actor_user_id: 'admin-1',
            lens_user_id: 'owner-1',
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
            lens_user_id: null,
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
})
