import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Archive,
  Bot,
  CircleHelp,
  Command,
  Download,
  ExternalLink,
  FileBox,
  FolderKanban,
  KeyRound,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  Square,
  TerminalSquare,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import {
  API_BASE_URL,
  artifactUrl,
  authToken,
  cancelTask,
  createApiKey,
  createTask,
  exchangeTicket,
  getApiKeys,
  getMe,
  getModels,
  getQuota,
  getTask,
  getUsage,
  googleLoginUrl,
  logout,
  revokeApiKey,
  sendChat,
} from './api/client'
import { Composer } from './components/Composer'
import { MessageView } from './components/MessageView'
import { ThemeToggle } from './components/ThemeToggle'
import type { ApiKey, ChatMessage, ChatSession, ModelCard, Quota, Task, Usage, User } from './types'

type Page = 'chat' | 'tasks' | 'projects' | 'artifacts' | 'settings'

const pageMeta: Record<Page, { label: string; icon: typeof Bot }> = {
  chat: { label: 'Chat', icon: Bot },
  tasks: { label: 'Tasks', icon: Activity },
  projects: { label: 'Projects', icon: FolderKanban },
  artifacts: { label: 'Artifacts', icon: FileBox },
  settings: { label: 'Settings', icon: Settings },
}

function initials(name?: string | null) {
  return (name || 'N')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function loadStoredSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem('nvirya_chat_sessions')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveStoredSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem('nvirya_chat_sessions', JSON.stringify(sessions))
  } catch {
    // ignore
  }
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('nvirya_theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark'
  })

  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [page, setPage] = useState<Page>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [models, setModels] = useState<ModelCard[]>([])
  const [selectedModel, setSelectedModel] = useState('nvirya-auto')
  const [quota, setQuota] = useState<Quota | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])

  // Session & Chat State
  const [sessions, setSessions] = useState<ChatSession[]>(loadStoredSessions)
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => crypto.randomUUID())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const [task, setTask] = useState<Task | null>(null)
  const [taskError, setTaskError] = useState('')
  const [notice, setNotice] = useState('')
  const [composerMode, setComposerMode] = useState<'chat' | 'task'>('chat')
  const abortRef = useRef<AbortController | null>(null)

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('nvirya_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  // Restore session / ticket exchange
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const ticket = query.get('ticket')
    const error = query.get('error')
    if (error) setAuthError(`Google sign-in failed: ${error}`)

    const load = async () => {
      try {
        if (ticket) {
          const nextUser = await exchangeTicket(ticket)
          setUser(nextUser)
          window.history.replaceState({}, '', '/chat')
        } else if (authToken.get()) {
          setUser(await getMe())
        }
      } catch (err) {
        authToken.clear()
        setAuthError(err instanceof Error ? err.message : 'Unable to restore your session.')
      } finally {
        setAuthLoading(false)
      }
    }
    void load()
  }, [])

  // Load workspace data when authenticated
  useEffect(() => {
    if (!user) return
    const loadWorkspace = async () => {
      try {
        const [availableModels, currentQuota, currentUsage] = await Promise.all([
          getModels(),
          getQuota(),
          getUsage(),
        ])
        setModels(availableModels)
        setQuota(currentQuota)
        setUsage(currentUsage)
        if (availableModels[0] && !availableModels.some((model) => model.id === selectedModel)) {
          setSelectedModel(availableModels[0].id)
        }
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Could not load workspace data.')
      }
    }
    void loadWorkspace()
  }, [user])

  // Sync current conversation to session list
  useEffect(() => {
    if (messages.length === 0) return

    setSessions((prev) => {
      const firstUserMsg = messages.find((m) => m.role === 'user')
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 36).trim() + (firstUserMsg.content.length > 36 ? '...' : '')
        : 'New conversation'

      const existingIndex = prev.findIndex((s) => s.id === currentSessionId)
      let nextSessions: ChatSession[]
      if (existingIndex >= 0) {
        nextSessions = prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, title: s.title || title, updatedAt: new Date().toISOString(), messages }
            : s,
        )
      } else {
        const newSession: ChatSession = {
          id: currentSessionId,
          title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages,
        }
        nextSessions = [newSession, ...prev]
      }
      saveStoredSessions(nextSessions)
      return nextSessions
    })
  }, [messages, currentSessionId])

  // Poll task status
  useEffect(() => {
    if (!task || ['completed', 'failed', 'cancelled'].includes(task.status)) return
    const timer = window.setInterval(() => {
      void getTask(task.id)
        .then(setTask)
        .catch((err) =>
          setTaskError(err instanceof Error ? err.message : 'Task status unavailable.'),
        )
    }, 1800)
    return () => window.clearInterval(timer)
  }, [task])

  const handleNewChat = () => {
    const newId = crypto.randomUUID()
    setCurrentSessionId(newId)
    setMessages([])
    setDraft('')
    navigate('chat')
  }

  const handleSelectSession = (s: ChatSession) => {
    setCurrentSessionId(s.id)
    setMessages(s.messages)
    navigate('chat')
  }

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const nextSessions = sessions.filter((s) => s.id !== id)
    setSessions(nextSessions)
    saveStoredSessions(nextSessions)
    if (currentSessionId === id) {
      handleNewChat()
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setDraft('')
    setNotice('')

    if (composerMode === 'task') {
      try {
        setTaskError('')
        const nextTask = await createTask(selectedModel, content)
        setTask(nextTask)
        setPage('tasks')
        setNotice('Task created. Progress will update automatically.')
      } catch (err) {
        setTaskError(err instanceof Error ? err.message : 'Could not create task.')
      }
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      streaming: true,
    }

    const nextMessages = [...messages, userMessage]
    setMessages([...nextMessages, assistantMessage])
    setSending(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await sendChat(
        selectedModel,
        nextMessages
          .filter(({ role }) => role !== 'system')
          .map(({ role, content: text }) => ({
            role: role as 'user' | 'assistant',
            content: text,
          })),
        controller.signal,
        (token) => {
          setMessages((current) =>
            current.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: msg.content + token }
                : msg,
            ),
          )
        },
      )
      setMessages((current) =>
        current.map((msg) =>
          msg.id === assistantMessage.id ? { ...msg, streaming: false } : msg,
        ),
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((current) =>
          current.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  content: err instanceof Error ? err.message : 'The response failed.',
                  streaming: false,
                }
              : msg,
          ),
        )
      }
    } finally {
      abortRef.current = null
      setSending(false)
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      authToken.clear()
    }
    setUser(null)
    setMessages([])
  }

  function navigate(nextPage: Page) {
    setPage(nextPage)
    setSidebarOpen(false)
  }

  if (authLoading) {
    return (
      <div className="loading-screen">
        <LoaderCircle className="spin" size={26} color="var(--accent-primary)" />
        <span>Initializing workspace...</span>
      </div>
    )
  }

  if (!user) return <Login error={authError} />

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-row">
          <img src="/logo.png" alt="Nvirya" className="brand-logo-img" />
          <span className="brand-name">Nvirya AI</span>
          <span className="brand-version">v1.2</span>
          <button
            className="icon-button sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* New Chat Button */}
        <button className="new-chat" onClick={handleNewChat}>
          <Plus size={16} />
          <span>New chat</span>
          <span className="shortcut">⌘ K</span>
        </button>

        {/* Primary Navigation */}
        <nav className="primary-nav" aria-label="Primary navigation">
          {(Object.keys(pageMeta) as Page[]).map((item) => {
            const MetaIcon = pageMeta[item].icon
            return (
              <button
                key={item}
                className={`nav-item ${page === item ? 'active' : ''}`}
                onClick={() => navigate(item)}
              >
                <MetaIcon size={16} />
                <span>{pageMeta[item].label}</span>
                {item === 'tasks' && task && !['completed', 'failed', 'cancelled'].includes(task.status) && (
                  <span className="nav-dot" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Recent Conversations */}
        {sessions.length > 0 && (
          <div className="sidebar-history-section">
            <div className="history-header">
              <span>Recents</span>
            </div>
            <div className="history-list">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`history-item ${s.id === currentSessionId && page === 'chat' ? 'active' : ''}`}
                  onClick={() => handleSelectSession(s)}
                  role="button"
                  tabIndex={0}
                >
                  <MessageSquare size={13} />
                  <span>{s.title}</span>
                  <button
                    className="icon-button compact-del"
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    aria-label="Delete chat"
                    style={{ width: 18, height: 18, border: 'none', background: 'transparent' }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sidebar Bottom */}
        <div className="sidebar-bottom">
          {quota && (
            <div className="quota-mini">
              <div>
                <span>Daily allowance</span>
                <strong>
                  {quota.daily_remaining}
                  <small>/{quota.daily_limit}</small>
                </strong>
              </div>
              <div className="quota-bar">
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      (quota.daily_used / Math.max(quota.daily_limit, 1)) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Theme Toggle in Sidebar */}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />

          {/* User Profile */}
          <button className="profile-row" onClick={() => navigate('settings')}>
            <span className="avatar">
              {user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user.username)}
            </span>
            <span className="profile-copy">
              <strong>{user.username}</strong>
              <small>{user.plan} plan</small>
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile scrim */}
      {sidebarOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>

          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{pageMeta[page].label}</strong>
          </div>

          <div className="topbar-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} compact />
            <button
              className="icon-button"
              onClick={() => navigate('settings')}
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </header>

        {notice && (
          <div className="notice animate-fade-in">
            <CircleHelp size={15} />
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Dismiss notice">
              <X size={15} />
            </button>
          </div>
        )}

        <div className="page-wrap">
          {page === 'chat' && (
            <ChatPage
              messages={messages}
              draft={draft}
              setDraft={setDraft}
              onSubmit={handleSubmit}
              sending={sending}
              selectedModel={selectedModel}
              models={models}
              setSelectedModel={setSelectedModel}
              onStop={() => abortRef.current?.abort()}
            />
          )}
          {page === 'tasks' && (
            <TasksPage
              task={task}
              error={taskError}
              onCancel={async () => {
                if (task) {
                  const result = await cancelTask(task.id)
                  setTask({ ...task, status: result.status })
                }
              }}
              onRefresh={async () => {
                if (task) setTask(await getTask(task.id))
              }}
            />
          )}
          {page === 'projects' && (
            <UnavailablePage
              icon={<FolderKanban size={24} />}
              title="Projects are coming soon"
              detail="The current backend API will expose workspace project groupings in an upcoming release."
            />
          )}
          {page === 'artifacts' && <ArtifactsPage />}
          {page === 'settings' && (
            <SettingsPage
              user={user}
              usage={usage}
              quota={quota}
              apiKeys={apiKeys}
              setApiKeys={setApiKeys}
              onLogout={handleLogout}
            />
          )}
        </div>
      </main>
    </div>
  )
}

/* ==========================================================================
   Chat Page Component
   ========================================================================== */

function ChatPage(props: {
  messages: ChatMessage[]
  draft: string
  setDraft: (value: string) => void
  onSubmit: (event: FormEvent) => void
  sending: boolean
  selectedModel: string
  models: ModelCard[]
  setSelectedModel: (value: string) => void
  onStop: () => void
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [props.messages])

  return (
    <section className="chat-page">
      <div className="chat-column">
        {props.messages.length === 0 ? (
          <EmptyChat />
        ) : (
          <div className="messages-feed">
            {props.messages.map((message) => (
              <MessageView key={message.id} message={message} />
            ))}
            <div ref={endRef} />
          </div>
        )}

        <Composer
          draft={props.draft}
          setDraft={props.setDraft}
          onSubmit={props.onSubmit}
          sending={props.sending}
          onStop={props.onStop}
          selectedModel={props.selectedModel}
          setSelectedModel={props.setSelectedModel}
          models={props.models}
        />
      </div>
    </section>
  )
}

function EmptyChat() {
  return (
    <div className="empty-chat-container">
      <div className="empty-logo-glow">
        <img src="/logo.png" alt="Nvirya AI" className="hero-logo-img" />
      </div>
      <h1>Work with intelligence.</h1>
      <p>
        Engage with state-of-the-art AI reasoning models, hand off multi-step tasks, or generate
        production-ready code.
      </p>
    </div>
  )
}

/* ==========================================================================
   Tasks Page Component
   ========================================================================== */

function TasksPage({
  task,
  error,
  onCancel,
  onRefresh,
}: {
  task: Task | null
  error: string
  onCancel: () => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const active = task && !['completed', 'failed', 'cancelled'].includes(task.status)

  return (
    <section className="content-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Agent Runtime</p>
          <h1>Tasks</h1>
          <p>Monitor asynchronous tasks started from the task composer.</p>
        </div>
        {task && (
          <button className="secondary-button" onClick={() => void onRefresh()}>
            <Activity size={15} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {!task ? (
        <div className="empty-panel">
          <Activity size={26} />
          <h2>No tasks in this session</h2>
          <p>Create an asynchronous task from Chat to monitor live execution steps here.</p>
        </div>
      ) : (
        <div className="task-card">
          <div className="task-card-top">
            <div>
              <span className={`status-pill ${task.status}`}>{task.status}</span>
              <h2>{task.id}</h2>
              <p>
                Model {task.model}
                {task.selected_model ? ` · routed to ${task.selected_model}` : ''}
              </p>
            </div>
            {active && (
              <button className="danger-button" onClick={() => void onCancel()}>
                <Square size={13} />
                <span>Cancel</span>
              </button>
            )}
          </div>
          <div className="progress-track">
            <span
              style={{ width: `${Math.min(100, Math.max(8, task.current_step * 12.5))}%` }}
            />
          </div>
          <div className="task-meta">
            <span>Step {task.current_step}</span>
            <span>Created {dateLabel(task.created_at)}</span>
          </div>
          {task.result && (
            <div className="result-box">
              <div className="result-label">Result</div>
              <p>{task.result}</p>
            </div>
          )}
          {(task.error || error) && (
            <div className="error-box">
              <CircleHelp size={15} />
              <span>{task.error || error}</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* ==========================================================================
   Artifacts Page Component
   ========================================================================== */

function ArtifactsPage() {
  const [artifactId, setArtifactId] = useState('')

  return (
    <section className="content-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Generated Outputs</p>
          <h1>Artifacts</h1>
          <p>Retrieve and download artifacts generated by agent tasks.</p>
        </div>
      </div>
      <div className="artifact-lookup">
        <div className="lookup-icon">
          <FileBox size={22} />
        </div>
        <div>
          <h2>Artifact Access</h2>
          <p>
            Enter the artifact ID provided by the agent task response to retrieve or download the file.
          </p>
          <div className="lookup-form">
            <input
              value={artifactId}
              onChange={(event) => setArtifactId(event.target.value)}
              placeholder="art_..."
              aria-label="Artifact ID"
            />
            <a
              className={`primary-button ${!artifactId.trim() ? 'disabled' : ''}`}
              href={artifactId.trim() ? artifactUrl(artifactId.trim()) : undefined}
              target="_blank"
              rel="noreferrer"
            >
              <Download size={14} />
              <span>Open artifact</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   Unavailable View Component
   ========================================================================== */

function UnavailablePage({
  icon,
  title,
  detail,
}: {
  icon: ReactNode
  title: string
  detail: string
}) {
  return (
    <section className="content-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Roadmap</p>
          <h1>{title}</h1>
          <p>{detail}</p>
        </div>
      </div>
      <div className="empty-panel">
        <div className="lookup-icon">{icon}</div>
        <h2>Feature in development</h2>
        <p>This surface is designed and ready to connect when the backend endpoint is enabled.</p>
      </div>
    </section>
  )
}

/* ==========================================================================
   Settings Page Component
   ========================================================================== */

function SettingsPage({
  user,
  usage,
  quota,
  apiKeys,
  setApiKeys,
  onLogout,
}: {
  user: User
  usage: Usage | null
  quota: Quota | null
  apiKeys: ApiKey[]
  setApiKeys: (keys: ApiKey[]) => void
  onLogout: () => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [newKey, setNewKey] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!loaded) {
      void getApiKeys()
        .then((keys) => {
          setApiKeys(keys)
          setLoaded(true)
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : 'Unable to load API keys.'),
        )
    }
  }, [loaded, setApiKeys])

  const issueKey = async () => {
    try {
      const created = await createApiKey(label.trim())
      setApiKeys([...apiKeys, created])
      setNewKey(created.key)
      setLabel('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create API key.')
    }
  }

  const revoke = async (id: string) => {
    try {
      await revokeApiKey(id)
      setApiKeys(
        apiKeys.map((key) =>
          key.id === id ? { ...key, revoked_at: new Date().toISOString() } : key,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to revoke API key.')
    }
  }

  return (
    <section className="content-page settings-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Workspace Configuration</p>
          <h1>Settings</h1>
          <p>Account credentials, usage telemetry, and developer API keys.</p>
        </div>
        <button className="secondary-button" onClick={() => void onLogout()}>
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>

      <div className="settings-grid">
        {/* Profile Card */}
        <div className="settings-card profile-card">
          <div className="settings-card-heading">
            <span className="card-icon">
              <Settings size={16} />
            </span>
            <div>
              <h2>Profile</h2>
              <p>Authenticated identity details from Google OAuth.</p>
            </div>
          </div>
          <div className="profile-large">
            <span className="avatar large-avatar">
              {user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user.username)}
            </span>
            <div>
              <strong>{user.username}</strong>
              <span>{user.email || 'No email reported'}</span>
              <small>Plan: {user.plan}</small>
            </div>
          </div>
        </div>

        {/* Usage Telemetry */}
        <div className="settings-card">
          <div className="settings-card-heading">
            <span className="card-icon">
              <Activity size={16} />
            </span>
            <div>
              <h2>Usage Telemetry</h2>
              <p>Aggregated tokens & requests reported by backend.</p>
            </div>
          </div>
          <div className="metric-grid">
            <Metric label="Requests" value={usage?.total_requests ?? '—'} />
            <Metric label="Tokens" value={usage?.total_tokens ?? '—'} />
            <Metric label="Tool Calls" value={usage?.total_tool_calls ?? '—'} />
            <Metric
              label="Remaining Tasks"
              value={quota ? `${quota.daily_remaining}/${quota.daily_limit}` : '—'}
            />
          </div>
        </div>

        {/* API Keys Card */}
        <div className="settings-card api-keys-card">
          <div className="settings-card-heading">
            <span className="card-icon">
              <KeyRound size={16} />
            </span>
            <div>
              <h2>API Keys</h2>
              <p>Secret tokens for programmatic access to the Nvirya API.</p>
            </div>
          </div>

          <div className="key-create">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Key label (e.g., Development, CI/CD)"
            />
            <button className="primary-button" onClick={() => void issueKey()}>
              <Plus size={14} />
              <span>Create key</span>
            </button>
          </div>

          {newKey && (
            <div className="new-key animate-fade-in">
              <span>
                <strong>Save this key immediately:</strong>
                <code>{newKey}</code>
              </span>
              <button
                className="icon-button"
                onClick={() => void navigator.clipboard?.writeText(newKey)}
                aria-label="Copy API key"
              >
                <Download size={14} />
              </button>
            </div>
          )}

          {error && (
            <div className="error-box">
              <CircleHelp size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="key-list">
            {apiKeys.length === 0 && loaded ? (
              <span className="muted-text">No API keys created yet.</span>
            ) : (
              apiKeys.map((key) => (
                <div className="key-row" key={key.id}>
                  <div>
                    <strong>{key.label || 'Unlabelled key'}</strong>
                    <code>{key.key_prefix}••••••••</code>
                  </div>
                  <div>
                    <span>
                      {key.revoked_at
                        ? 'Revoked'
                        : key.last_used_at
                        ? `Used ${dateLabel(key.last_used_at)}`
                        : `Created ${dateLabel(key.created_at)}`}
                    </span>
                    {!key.revoked_at && (
                      <button
                        className="text-button danger-text"
                        onClick={() => void revoke(key.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

/* ==========================================================================
   Login Component
   ========================================================================== */

function Login({ error }: { error: string }) {
  return (
    <div className="login-screen">
      <div className="login-panel">
        <img src="/logo.png" alt="Nvirya AI" className="login-logo-img" />
        <p className="eyebrow">Nvirya AI</p>
        <h1>Work with intelligence.</h1>
        <p className="login-detail">
          A modern unified workspace for conversations, agent tasks, and generated outputs.
        </p>

        <a className="google-button" href={googleLoginUrl()}>
          <GoogleGlyph />
          <span>Continue with Google</span>
          <ExternalLink size={14} />
        </a>

        {error && (
          <div className="error-box">
            <CircleHelp size={15} />
            <span>{error}</span>
          </div>
        )}

        <p className="login-foot">
          API Endpoint <code>{API_BASE_URL || 'same-origin /api'}</code>
        </p>
      </div>
    </div>
  )
}

function GoogleGlyph() {
  return <span className="google-glyph">G</span>
}

export default App
