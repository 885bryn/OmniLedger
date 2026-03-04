export type ApiIssue = {
  field: string
  code: string
  category: string
  message: string
}

export type SafetyToastCode = 'policy_denied' | 'invalid_lens'

const OWNERSHIP_POLICY_MESSAGE = 'You can only access your own records.'

export const API_SAFETY_TOAST_EVENT = 'hact:safety-toast'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function emitSafetyToast(code: SafetyToastCode) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(API_SAFETY_TOAST_EVENT, {
      detail: {
        code,
      },
    }),
  )
}

function hasOwnershipPolicyMessage(message: string | undefined) {
  return typeof message === 'string' && message.includes(OWNERSHIP_POLICY_MESSAGE)
}

function resolveSafetyToastCode(params: {
  method: string
  message?: string
  issues?: ApiIssue[]
}): SafetyToastCode | undefined {
  if (!WRITE_METHODS.has(params.method)) {
    return undefined
  }

  if (hasOwnershipPolicyMessage(params.message)) {
    return 'policy_denied'
  }

  const hasOwnershipIssue = (params.issues ?? []).some((issue) => hasOwnershipPolicyMessage(issue.message))
  if (hasOwnershipIssue) {
    return 'policy_denied'
  }

  return undefined
}

export function isOwnershipPolicyMessage(message: string | null | undefined) {
  return hasOwnershipPolicyMessage(message ?? undefined)
}

export class ApiClientError extends Error {
  status: number
  code: string
  category?: string
  issues: ApiIssue[]
  safetyToastCode?: SafetyToastCode
  cooldown?: {
    retry_after_seconds?: number
  } | null

  constructor(params: {
    status: number
    code: string
    message: string
    category?: string
    issues?: ApiIssue[]
    safetyToastCode?: SafetyToastCode
    cooldown?: {
      retry_after_seconds?: number
    } | null
  }) {
    super(params.message)
    this.name = 'ApiClientError'
    this.status = params.status
    this.code = params.code
    this.category = params.category
    this.issues = params.issues ?? []
    this.safetyToastCode = params.safetyToastCode
    this.cooldown = params.cooldown
  }
}

type EnvelopeError = {
  error?: {
    code?: string
    category?: string
    message?: string
    issues?: ApiIssue[]
    cooldown?: {
      retry_after_seconds?: number
    } | null
  }
}

export type TransportUser = {
  id: string
  username: string
  email: string
  created_at?: string
  updated_at?: string
}

export type TransportItemActivityRow = {
  id: string
  user_id: string
  actor_user_id: string | null
  actor_label: string | null
  lens_user_id: string | null
  lens_label: string | null
  lens_attribution_state: 'attributed' | 'legacy_missing' | 'all_data'
  action: string
  entity: string
  entity_type: string | null
  entity_id: string | null
  timestamp: string
  event_type: string | null
  event_status: string | null
  event_due_date: string | null
  event_amount: string | null
  event_completed_at: string | null
}

export type TransportItemActivityResponse = {
  item_id: string
  activity: TransportItemActivityRow[]
}

export const SESSION_EXPIRED_EVENT = 'hact:session-expired'

function normalizeBaseUrl(value: string | undefined) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\/+$/, '')
}

export function resolveApiBaseUrl(env: Record<string, string | boolean | undefined> = import.meta.env) {
  const explicitBaseUrl = normalizeBaseUrl(env.VITE_API_BASE_URL as string | undefined)
  if (explicitBaseUrl.length > 0) {
    return explicitBaseUrl
  }

  const nasStaticIp = normalizeBaseUrl(env.VITE_NAS_STATIC_IP as string | undefined)
  if (nasStaticIp.length > 0) {
    return `http://${nasStaticIp}:8080`
  }

  return 'http://localhost:8080'
}

export const API_BASE_URL = resolveApiBaseUrl()

async function parseJsonBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

function withHeaders(headers?: HeadersInit) {
  const requestHeaders = new Headers(headers)

  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json')
  }

  return requestHeaders
}

type ApiRequestInit = Omit<RequestInit, 'body'> & {
  body?: unknown
}

export async function apiRequest<TResponse>(path: string, init: ApiRequestInit = {}): Promise<TResponse> {
  const headers = withHeaders(init.headers)
  const payload = init.body

  let body: BodyInit | null | undefined

  if (typeof payload === 'string' || payload instanceof FormData || payload instanceof URLSearchParams || payload instanceof Blob || payload instanceof ArrayBuffer) {
    body = payload
  } else if (ArrayBuffer.isView(payload)) {
    body = payload as unknown as BodyInit
  } else if (payload && typeof payload === 'object') {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    body = JSON.stringify(payload)
  } else if (payload === undefined || payload === null) {
    body = undefined
  } else {
    body = String(payload)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    body,
    credentials: init.credentials ?? 'include',
  })

  const responseBody = await parseJsonBody(response)

  if (!response.ok) {
    if (typeof window !== 'undefined' && response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(
        new CustomEvent(SESSION_EXPIRED_EVENT, {
          detail: {
            path,
          },
        }),
      )
    }

    const envelope = (responseBody as EnvelopeError | null)?.error
    const method = (init.method ?? 'GET').toUpperCase()
    const safetyToastCode = resolveSafetyToastCode({
      method,
      message: envelope?.message,
      issues: envelope?.issues,
    })

    if (safetyToastCode) {
      emitSafetyToast(safetyToastCode)
    }

    throw new ApiClientError({
      status: response.status,
      code: envelope?.code || 'request_failed',
      category: envelope?.category,
      message: envelope?.message || `Request failed with status ${response.status}`,
      issues: envelope?.issues,
      safetyToastCode,
      cooldown: envelope?.cooldown,
    })
  }

  return responseBody as TResponse
}

export async function fetchUsers() {
  return apiRequest<{ users: TransportUser[]; total_count: number }>('/users')
}
