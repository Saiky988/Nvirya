import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Archive,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  Copy,
  Download,
  ExternalLink,
  FileBox,
  FolderKanban,
  KeyRound,
  LoaderCircle,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  Square,
  TerminalSquare,
  X,
  Zap,
} from 'lucide-react'
import {
  API_BASE_URL,
  ApiError,
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
import type { ApiKey, ChatMessage, ModelCard, Quota, Task, Usage, User } from './types'

type Page = 'chat' | 'tasks' | 'projects' | 'artifacts' | 'settings'

const pageMeta: Record<Page, { label: string; icon: typeof Bot }> = {
  chat: { label: 'Chat', icon: Bot },
  tasks: { label: 'Tasks', icon: Activity },
  projects: { label: 'Projects', icon: FolderKanban },
  artifacts: { label: 'Artifacts', icon: FileBox },
  settings: { label: 'Settings', icon: Settings },
}

function initials(name?: string | null) {
  return (name || 'N').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function App() {
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [task, setTask] = useState<Task | null>(null)
  const [taskError, setTaskError] = useState('')
  const [notice, setNotice] = useState('')
  const [composerMode, setComposerMode] = useState<'chat' | 'task'>('chat')
  const abortRef = useRef<AbortController | null>(null)

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

  useEffect(() => {
    if (!user) return
    const loadWorkspace = async () => {
      try {
        const [availableModels, currentQuota, currentUsage] = await Promise.all([getModels(), getQuota(), getUsage()])
        setModels(availableModels)
        setQuota(currentQuota)
        setUsage(currentUsage)
        if (availableModels[0] && !availableModels.some((model) => model.id === selectedModel)) setSelectedModel(availableModels[0].id)
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Could not load workspace data.')
      }
    }
    void loadWorkspace()
  }, [user])

  useEffect(() => {
    if (!task || ['completed', 'failed', 'cancelled'].includes(task.status)) return
    const timer = window.setInterval(() => {
      void getTask(task.id).then(setTask).catch((err) => setTaskError(err instanceof Error ? err.message : 'Task status unavailable.'))
    }, 1800)
    return () => window.clearInterval(timer)
  }, [task])

  const modelLabel = useMemo(() => selectedModel.replace('nvirya-', 'Nvirya '), [selectedModel])

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
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content, createdAt: new Date().toISOString() }
    const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', createdAt: new Date().toISOString(), streaming: true }
    const nextMessages = [...messages, userMessage]
    setMessages([...nextMessages, assistantMessage])
    setSending(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await sendChat(selectedModel, nextMessages.filter(({ role }) => role !== 'system').map(({ role, content: text }) => ({ role: role as 'user' | 'assistant', content: text })), controller.signal, (token) => {
        setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, content: message.content + token } : message))
      })
      setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, streaming: false } : message))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, content: err instanceof Error ? err.message : 'The response failed.', streaming: false } : message))
      }
    } finally {
      abortRef.current = null
      setSending(false)
    }
  }

  async function handleLogout() {
    try { await logout() } catch { authToken.clear() }
    setUser(null)
    setMessages([])
  }

  function navigate(nextPage: Page) {
    setPage(nextPage)
    setSidebarOpen(false)
  }

  if (authLoading) return <div className="loading-screen"><LoaderCircle className="spin" size={22} /><span>Restoring workspace</span></div>
  if (!user) return <Login error={authError} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-row"><div className="brand-mark">N</div><span className="brand-name">nvirya</span><button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
        <button className="new-chat" onClick={() => { navigate('chat'); setMessages([]) }}><Plus size={16} /> New chat <span className="shortcut">⌘ K</span></button>
        <nav className="primary-nav" aria-label="Primary navigation">
          {(Object.keys(pageMeta) as Page[]).map((item) => {
            const MetaIcon = pageMeta[item].icon
            return <button key={item} className={`nav-item ${page === item ? 'active' : ''}`} onClick={() => navigate(item)}><MetaIcon size={17} /><span>{pageMeta[item].label}</span>{item === 'tasks' && task && !['completed', 'failed', 'cancelled'].includes(task.status) ? <span className="nav-dot" /> : null}</button>
          })}
        </nav>
        <div className="sidebar-bottom">
          {quota ? <div className="quota-mini"><div><span>Daily tasks</span><strong>{quota.daily_remaining}<small>/{quota.daily_limit}</small></strong></div><div className="quota-bar"><span style={{ width: `${Math.min(100, (quota.daily_used / Math.max(quota.daily_limit, 1)) * 100)}%` }} /></div></div> : null}
          <button className="profile-row" onClick={() => navigate('settings')}><span className="avatar">{user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user.username)}</span><span className="profile-copy"><strong>{user.username}</strong><small>{user.plan} plan</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>
      {sidebarOpen ? <button className="mobile-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" /> : null}
      <main className="main-content">
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="breadcrumb"><span>Workspace</span><span className="slash">/</span><strong>{pageMeta[page].label}</strong></div><div className="topbar-actions"><button className="search-button" onClick={() => setNotice('Global search is not available: the backend exposes no search endpoint.') }><Search size={16} /><span>Search</span><kbd>⌘ K</kbd></button><button className="icon-button" onClick={() => navigate('settings')} aria-label="Settings"><Settings size={17} /></button></div></header>
        {notice ? <div className="notice"><CircleHelp size={15} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={15} /></button></div> : null}
        <div className="page-wrap">
          {page === 'chat' ? <ChatPage messages={messages} draft={draft} setDraft={setDraft} onSubmit={handleSubmit} sending={sending} selectedModel={selectedModel} modelLabel={modelLabel} models={models} setSelectedModel={setSelectedModel} composerMode={composerMode} setComposerMode={setComposerMode} onStop={() => abortRef.current?.abort()} /> : null}
          {page === 'tasks' ? <TasksPage task={task} error={taskError} onCancel={async () => { if (task) { const result = await cancelTask(task.id); setTask({ ...task, status: result.status }) } }} onRefresh={async () => { if (task) setTask(await getTask(task.id)) }} /> : null}
          {page === 'projects' ? <UnavailablePage icon={<FolderKanban size={22} />} title="Projects are not connected" detail="The current API does not expose project list or project detail routes. This view will become live when that contract is available." /> : null}
          {page === 'artifacts' ? <ArtifactsPage /> : null}
          {page === 'settings' ? <SettingsPage user={user} usage={usage} quota={quota} apiKeys={apiKeys} setApiKeys={setApiKeys} onLogout={handleLogout} /> : null}
        </div>
      </main>
    </div>
  )
}

function Login({ error }: { error: string }) {
  return <div className="login-screen"><div className="login-panel"><div className="brand-mark large">N</div><p className="eyebrow">Nvirya AI</p><h1>Work with intelligence.</h1><p className="login-detail">A focused workspace for conversations, agent tasks, and generated outputs.</p><a className="google-button" href={googleLoginUrl()}><GoogleGlyph /> Continue with Google <ExternalLink size={15} /></a>{error ? <div className="error-box"><CircleHelp size={16} />{error}</div> : null}<p className="login-foot">API endpoint <code>{API_BASE_URL || 'same-origin /api'}</code></p></div></div>
}

function ChatPage(props: { messages: ChatMessage[]; draft: string; setDraft: (value: string) => void; onSubmit: (event: FormEvent) => void; sending: boolean; selectedModel: string; modelLabel: string; models: ModelCard[]; setSelectedModel: (value: string) => void; composerMode: 'chat' | 'task'; setComposerMode: (value: 'chat' | 'task') => void; onStop: () => void }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [props.messages])
  return <section className="chat-page"><div className="chat-column"><div className="chat-heading"><div><p className="eyebrow">Nvirya workspace</p><h1>What are you working on?</h1><p>Ask a question, explore an idea, or hand off a multi-step task.</p></div><button className="icon-button" aria-label="More chat actions"><MoreHorizontal size={19} /></button></div>{props.messages.length === 0 ? <EmptyChat /> : <div className="messages">{props.messages.map((message) => <Message key={message.id} message={message} />)}<div ref={endRef} /></div>}<form className="composer" onSubmit={props.onSubmit}><div className="composer-toolbar"><div className="segmented"><button type="button" className={props.composerMode === 'chat' ? 'selected' : ''} onClick={() => props.setComposerMode('chat')}><Sparkles size={14} /> Chat</button><button type="button" className={props.composerMode === 'task' ? 'selected' : ''} onClick={() => props.setComposerMode('task')}><TerminalSquare size={14} /> Task</button></div><label className="model-select"><span>{props.modelLabel}</span><ChevronDown size={14} /><select value={props.selectedModel} onChange={(event) => props.setSelectedModel(event.target.value)} aria-label="Select model">{(props.models.length ? props.models : [{ id: props.selectedModel } as ModelCard]).map((model) => <option key={model.id} value={model.id}>{model.id}</option>)}</select></label></div><textarea value={props.draft} onChange={(event) => props.setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); props.onSubmit(event) } }} placeholder={props.composerMode === 'task' ? 'Describe the task to run asynchronously...' : 'Message Nvirya...'} rows={2} /><div className="composer-bottom"><span className="composer-hint">{props.composerMode === 'task' ? 'Runs with progress tracking' : 'Enter to send · Shift + Enter for a new line'}</span>{props.sending ? <button type="button" className="send-button stop" onClick={props.onStop} aria-label="Stop response"><Square size={15} fill="currentColor" /></button> : <button type="submit" className="send-button" disabled={!props.draft.trim()} aria-label="Send message"><ArrowUp size={17} /></button>}</div></form></div><div className="chat-aside"><div className="aside-label"><span>Workspace status</span><Activity size={15} /></div><div className="status-line"><span className="status-dot green" /><span>Cloud runtime ready</span></div><div className="aside-divider" /><p className="aside-title">Capabilities</p><div className="capability-list"><span><Zap size={14} /> Model routing</span><span><TerminalSquare size={14} /> Agent tools</span><span><Archive size={14} /> Artifact storage</span></div><div className="aside-foot"><span className="status-dot amber" /> Local runtime unavailable</div></div></section>
}

function EmptyChat() {
  return <div className="empty-chat"><div className="empty-icon"><Command size={21} /></div><h2>Start a new conversation</h2><p>Use Nvirya Auto for general work, or choose Task to monitor a longer agent run.</p><div className="suggestions"><button>Summarize a technical decision</button><button>Plan a focused research task</button><button>Help me understand this error</button></div></div>
}

function Message({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard?.writeText(message.content); setCopied(true); window.setTimeout(() => setCopied(false), 1400) }
  return <article className={`message ${message.role}`}><div className={`message-avatar ${message.role}`}>{message.role === 'assistant' ? <Bot size={15} /> : 'You'}</div><div className="message-body"><div className="message-meta"><strong>{message.role === 'assistant' ? 'Nvirya' : 'You'}</strong><span>{dateLabel(message.createdAt)}</span></div><div className="message-content">{message.content || (message.streaming ? <span className="typing"><i /><i /><i /></span> : '')}</div>{message.role === 'assistant' && message.content ? <button className="copy-button" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}</button> : null}</div></article>
}

function TasksPage({ task, error, onCancel, onRefresh }: { task: Task | null; error: string; onCancel: () => Promise<void>; onRefresh: () => Promise<void> }) {
  const active = task && !['completed', 'failed', 'cancelled'].includes(task.status)
  return <section className="content-page"><div className="section-heading"><div><p className="eyebrow">Agent runtime</p><h1>Tasks</h1><p>Monitor asynchronous work started from the task composer.</p></div>{task ? <button className="secondary-button" onClick={() => void onRefresh()}><Activity size={15} /> Refresh</button> : null}</div>{!task ? <div className="empty-panel"><Activity size={22} /><h2>No tasks in this session</h2><p>Create an asynchronous task from Chat to see live status and results here.</p></div> : <div className="task-card"><div className="task-card-top"><div><span className={`status-pill ${task.status}`}>{task.status}</span><h2>{task.id}</h2><p>Model {task.model}{task.selected_model ? ` · routed to ${task.selected_model}` : ''}</p></div>{active ? <button className="danger-button" onClick={() => void onCancel()}><Square size={14} /> Cancel</button> : null}</div><div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(8, task.current_step * 12.5))}%` }} /></div><div className="task-meta"><span>Step {task.current_step}</span><span>Created {dateLabel(task.created_at)}</span></div>{task.result ? <div className="result-box"><div className="result-label">Result</div><p>{task.result}</p></div> : null}{task.error || error ? <div className="error-box"><CircleHelp size={15} />{task.error || error}</div> : null}</div>}</section>
}

function ArtifactsPage() {
  const [artifactId, setArtifactId] = useState('')
  return <section className="content-page"><div className="section-heading"><div><p className="eyebrow">Generated outputs</p><h1>Artifacts</h1><p>Open an artifact when a task has returned its backend-provided identifier.</p></div></div><div className="artifact-lookup"><div className="lookup-icon"><FileBox size={21} /></div><div><h2>Artifact access</h2><p>The current API supports authenticated retrieval by artifact ID, but does not expose an artifact list endpoint.</p><div className="lookup-form"><input value={artifactId} onChange={(event) => setArtifactId(event.target.value)} placeholder="art_..." aria-label="Artifact ID" /><a className={`secondary-button ${!artifactId.trim() ? 'disabled' : ''}`} href={artifactId.trim() ? artifactUrl(artifactId.trim()) : undefined} target="_blank" rel="noreferrer"><Download size={15} /> Open artifact</a></div></div></div></section>
}

function UnavailablePage({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <section className="content-page"><div className="section-heading"><div><p className="eyebrow">Coming from the API</p><h1>{title}</h1><p>{detail}</p></div></div><div className="empty-panel muted"><div className="empty-icon">{icon}</div><h2>Not available in this backend</h2><p>The frontend keeps this surface ready without showing fabricated data.</p></div></section>
}

function SettingsPage({ user, usage, quota, apiKeys, setApiKeys, onLogout }: { user: User; usage: Usage | null; quota: Quota | null; apiKeys: ApiKey[]; setApiKeys: (keys: ApiKey[]) => void; onLogout: () => Promise<void> }) {
  const [label, setLabel] = useState('')
  const [newKey, setNewKey] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { if (!loaded) { void getApiKeys().then((keys) => { setApiKeys(keys); setLoaded(true) }).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load API keys.')) } }, [loaded, setApiKeys])
  const issueKey = async () => { try { const created = await createApiKey(label.trim()); setApiKeys([...apiKeys, created]); setNewKey(created.key); setLabel('') } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create API key.') } }
  const revoke = async (id: string) => { try { await revokeApiKey(id); setApiKeys(apiKeys.map((key) => key.id === id ? { ...key, revoked_at: new Date().toISOString() } : key)) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to revoke API key.') } }
  return <section className="content-page settings-page"><div className="section-heading"><div><p className="eyebrow">Workspace configuration</p><h1>Settings</h1><p>Account, usage, and API access for this workspace.</p></div><button className="secondary-button" onClick={() => void onLogout()}><LogOut size={15} /> Sign out</button></div><div className="settings-grid"><div className="settings-card profile-card"><div className="settings-card-heading"><span className="card-icon"><Settings size={16} /></span><div><h2>Profile</h2><p>Authenticated user details from the backend.</p></div></div><div className="profile-large"><span className="avatar large-avatar">{user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user.username)}</span><div><strong>{user.username}</strong><span>{user.email || 'No email returned'}</span><small>Plan: {user.plan}</small></div></div></div><div className="settings-card"><div className="settings-card-heading"><span className="card-icon"><Activity size={16} /></span><div><h2>Usage</h2><p>Aggregated usage reported by the API.</p></div></div><div className="metric-grid"><Metric label="Requests" value={usage?.total_requests ?? '—'} /><Metric label="Tokens" value={usage?.total_tokens ?? '—'} /><Metric label="Tool calls" value={usage?.total_tool_calls ?? '—'} /><Metric label="Tasks left" value={quota ? `${quota.daily_remaining}/${quota.daily_limit}` : '—'} /></div></div><div className="settings-card api-keys-card"><div className="settings-card-heading"><span className="card-icon"><KeyRound size={16} /></span><div><h2>API keys</h2><p>Keys are shown in full only once when created.</p></div></div><div className="key-create"><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Key label (optional)" /><button className="primary-button" onClick={() => void issueKey()}><Plus size={15} /> Create key</button></div>{newKey ? <div className="new-key"><span><strong>Copy this key now</strong><code>{newKey}</code></span><button className="icon-button" onClick={() => void navigator.clipboard?.writeText(newKey)} aria-label="Copy API key"><Copy size={15} /></button></div> : null}{error ? <div className="error-box"><CircleHelp size={15} />{error}</div> : null}<div className="key-list">{apiKeys.length === 0 && loaded ? <span className="muted-text">No API keys created yet.</span> : apiKeys.map((key) => <div className="key-row" key={key.id}><div><strong>{key.label || 'Unlabelled key'}</strong><code>{key.key_prefix}••••••</code></div><div><span>{key.revoked_at ? 'Revoked' : key.last_used_at ? `Used ${dateLabel(key.last_used_at)}` : `Created ${dateLabel(key.created_at)}`}</span>{!key.revoked_at ? <button className="text-button danger-text" onClick={() => void revoke(key.id)}>Revoke</button> : null}</div></div>)}</div></div></div></section>
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div> }

function GoogleGlyph() { return <span className="google-glyph">G</span> }

export default App
