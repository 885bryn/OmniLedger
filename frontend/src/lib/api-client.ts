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

  constructor(params: { status: number; code: string; message: string; category?: string; issues?: ApiIssue[] }) {
    super(params.message)
    this.name = 'ApiClientError'
    this.status = params.status
    this.code = params.code
    this.category = params.category
    this.issues = params.issues ?? []
  }
}

type EnvelopeError = {
  error?: {
    code?: string
    category?: string
    message?: string
    issues?: ApiIssue[]
  }
}

export type TransportUser = {
  id: string
  username: string
  email: string
  created_at?: string
  updated_at?: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

let activeActorUserId: string | null = null

export function setActiveActorUserId(userId: string | null) {
  activeActorUserId = userId
}

export function getActiveActorUserId() {
  return activeActorUserId
}

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

  if (activeActorUserId) {
    requestHeaders.set('x-user-id', activeActorUserId)
  }

  return requestHeaders
}

export async function apiRequest<TResponse>(path: string, init: RequestInit = {}): Promise<TResponse> {
  const headers = withHeaders(init.headers)
  const payload = init.body

  let body: BodyInit | null | undefined = payload
  if (payload && typeof payload === 'object' && !(payload instanceof FormData) && !(payload instanceof URLSearchParams)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    body = JSON.stringify(payload)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    body,
  })

  const responseBody = await parseJsonBody(response)

  if (!response.ok) {
    const envelope = (responseBody as EnvelopeError | null)?.error

    throw new ApiClientError({
      status: response.status,
      code: envelope?.code || 'request_failed',
      category: envelope?.category,
      message: envelope?.message || `Request failed with status ${response.status}`,
      issues: envelope?.issues,
    })
  }

  return responseBody as TResponse
}

export async function fetchUsers() {
  return apiRequest<{ users: TransportUser[]; total_count: number }>('/users')
}
