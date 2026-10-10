export type Role = 'user' | 'assistant' | 'system'

export interface User {
  id: string
  username: string
  email?: string | null
  avatar_url?: string | null
  plan: string
  created_at: string
  last_login_at?: string | null
}

export interface ModelCard {
  id: string
  object: string
  created: number
  owned_by: string
}

export interface ChatMessage {
  role: Role
  content: string
  id: string
  createdAt: string
  streaming?: boolean
}

export interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export interface ChatCompletionResponse {
  id: string
  model: string
  choices: Array<{ message: { role: Role; content: string | null } }>
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export interface Task {
  id: string
  model: string
  selected_model?: string | null
  status: string
  current_step: number
  created_at: string
  started_at?: string | null
  completed_at?: string | null
  error?: string | null
  result?: string | null
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export interface Quota {
  daily_limit: number
  daily_used: number
  daily_remaining: number
  rate_limit_per_minute: number
}

export interface Usage {
  user_id: string
  total_requests: number
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
  total_tool_calls: number
}

export interface ApiKey {
  id: string
  key_prefix: string
  label?: string | null
  created_at: string
  revoked_at?: string | null
  last_used_at?: string | null
}

export interface CreatedApiKey extends ApiKey {
  key: string
}

export interface ApiErrorShape {
  error?: { message?: string }
  detail?: string
}
