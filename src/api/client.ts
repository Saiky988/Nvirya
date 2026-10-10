import type {
  ApiErrorShape,
  ApiKey,
  ChatCompletionResponse,
  ModelCard,
  Quota,
  Task,
  Usage,
  User,
  CreatedApiKey,
} from '../types'

const configuredBase = import.meta.env.VITE_API_BASE_URL || ''
export const API_BASE_URL = configuredBase.replace(/\/$/, '')
const API_V1 = `${API_BASE_URL}/api/v1`
const tokenKey = 'nvirya_session_token'

export const authToken = {
  get: () => localStorage.getItem(tokenKey),
  set: (value: string) => localStorage.setItem(tokenKey, value),
  clear: () => localStorage.removeItem(tokenKey),
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`
  try {
    const body = (await response.json()) as ApiErrorShape
    message = body.error?.message || body.detail || message
  } catch {
    // Keep the HTTP status message when the API does not return JSON.
  }
  return new ApiError(message, response.status)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = authToken.get()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_V1}${path}`, { ...init, headers, credentials: 'include' })
  if (!response.ok) throw await parseError(response)
  return response.json() as Promise<T>
}

export async function getMe() {
  return request<User>('/auth/me')
}

export async function exchangeTicket(ticket: string) {
  const response = await request<{ session_token: string; user: User }>('/auth/exchange', {
    method: 'POST',
    body: JSON.stringify({ ticket }),
  })
  authToken.set(response.session_token)
  return response.user
}

export async function logout() {
  await request('/auth/logout', { method: 'POST' })
  authToken.clear()
}

export function googleLoginUrl() {
  return `${API_V1}/auth/google/login`
}

export async function getModels() {
  const response = await request<{ data: ModelCard[] }>('/models')
  return response.data
}

export async function getQuota() {
  return request<Quota>('/quota')
}

export async function getUsage() {
  return request<Usage>('/usage')
}

export async function getApiKeys() {
  return request<ApiKey[]>('/api-keys')
}

export async function createApiKey(label: string) {
  return request<CreatedApiKey>('/api-keys', { method: 'POST', body: JSON.stringify({ label }) })
}

export async function revokeApiKey(id: string) {
  return request<{ id: string; revoked: boolean }>(`/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function createTask(model: string, message: string) {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ model, messages: [{ role: 'user', content: message }] }),
  })
}

export async function getTask(id: string) {
  return request<Task>(`/tasks/${encodeURIComponent(id)}`)
}

export async function cancelTask(id: string) {
  return request<{ id: string; status: string }>(`/tasks/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

export function artifactUrl(id: string) {
  return `${API_V1}/artifacts/${encodeURIComponent(id)}`
}

export async function sendChat(
  model: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  signal: AbortSignal,
  onToken: (token: string) => void,
): Promise<ChatCompletionResponse | null> {
  const token = authToken.get()
  const response = await fetch(`${API_V1}/chat/completions`, {
    method: 'POST',
    signal,
    credentials: 'include',
    headers: {
      Accept: 'text/event-stream, application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ model, messages, stream: true }),
  })
  if (!response.ok) throw await parseError(response)
  if (!response.body) return null

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) return (await response.json()) as ChatCompletionResponse

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResponse: ChatCompletionResponse | null = null
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''
    for (const event of events) {
      const data = event.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const chunk = JSON.parse(data) as ChatCompletionResponse & {
          choices: Array<{ delta?: { content?: string | null }; message?: { content?: string | null } }>
        }
        const next = chunk.choices[0]?.delta?.content || chunk.choices[0]?.message?.content
        if (next) onToken(next)
        if (chunk.usage) finalResponse = chunk
      } catch {
        // Ignore malformed keep-alive frames while preserving the stream.
      }
    }
  }
  return finalResponse
}
