export type ApiIssue = {
  field: string
  code: string
  category: string
  message: string
}

export class ApiClientError extends Error {
  status: number
  code: string
  category?: string
  issues: ApiIssue[]
  cooldown?: {
    retry_after_seconds?: number
  } | null

  constructor(params: {
    status: number
    code: string
    message: string
    category?: string
    issues?: ApiIssue[]
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

export const SESSION_EXPIRED_EVENT = 'hact:session-expired'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

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

    throw new ApiClientError({
      status: response.status,
      code: envelope?.code || 'request_failed',
      category: envelope?.category,
      message: envelope?.message || `Request failed with status ${response.status}`,
      issues: envelope?.issues,
      cooldown: envelope?.cooldown,
    })
  }

  return responseBody as TResponse
}

export async function fetchUsers() {
  return apiRequest<{ users: TransportUser[]; total_count: number }>('/users')
}
