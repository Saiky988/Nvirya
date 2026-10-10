import { FormEvent, KeyboardEvent, useEffect, useRef } from 'react'
import { ArrowUp, Sparkles, Square, TerminalSquare } from 'lucide-react'
import { ModelPicker } from './ModelPicker'
import type { ModelCard } from '../types'

interface ComposerProps {
  draft: string
  setDraft: (value: string) => void
  onSubmit: (event: FormEvent) => void
  sending: boolean
  onStop: () => void
  selectedModel: string
  setSelectedModel: (value: string) => void
  models: ModelCard[]
  composerMode: 'chat' | 'task'
  setComposerMode: (mode: 'chat' | 'task') => void
}

export function Composer({
  draft,
  setDraft,
  onSubmit,
  sending,
  onStop,
  selectedModel,
  setSelectedModel,
  models,
  composerMode,
  setComposerMode,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`
    }
  }, [draft])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e as unknown as FormEvent)
    }
  }

  const isTask = composerMode === 'task'

  return (
    <form className="composer-wrapper" onSubmit={onSubmit}>
      <div className="composer-top-bar">
        {/* Mode Segmented Switch */}
        <div className="mode-segmented-control">
          <button
            type="button"
            className={`mode-btn ${!isTask ? 'active' : ''}`}
            onClick={() => setComposerMode('chat')}
          >
            <Sparkles size={13} />
            <span>Chat</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${isTask ? 'active' : ''}`}
            onClick={() => setComposerMode('task')}
          >
            <TerminalSquare size={13} />
            <span>Task</span>
          </button>
        </div>

        {/* Model Picker */}
        <ModelPicker
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          models={models}
        />
      </div>

      {/* Main Textarea */}
      <div className="composer-input-area">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isTask
              ? 'Describe a multi-step task to execute asynchronously...'
              : 'Message Nvirya or ask a question...'
          }
          rows={1}
          disabled={sending}
        />
      </div>

      {/* Bottom Bar */}
      <div className="composer-footer-bar">
        <div className="composer-hints">
          <span>{isTask ? 'Executes in background' : 'Enter to send · Shift+Enter for new line'}</span>
        </div>

        <div className="composer-actions">
          {sending ? (
            <button
              type="button"
              className="send-action-btn stop"
              onClick={onStop}
              aria-label="Stop generation"
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              className="send-action-btn send"
              disabled={!draft.trim()}
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
