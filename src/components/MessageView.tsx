import React, { useState } from 'react'
import {
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ThumbsDown,
  ThumbsUp,
  User as UserIcon,
} from 'lucide-react'
import type { ChatMessage } from '../types'

interface MessageViewProps {
  message: ChatMessage
  onRetry?: () => void
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

// Lightweight Markdown & Code Block Formatter
function FormattedContent({ content }: { content: string }) {
  // Split code blocks ```lang ... ```
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      parts.push(
        <TextChunk
          key={`text-${lastIndex}`}
          text={content.slice(lastIndex, match.index)}
        />,
      )
    }

    const lang = match[1] || 'code'
    const code = match[2] || ''
    parts.push(
      <CodeSnippet key={`code-${match.index}`} language={lang} code={code} />,
    )
    lastIndex = match.index + match[0].length
  }

  // Trailing text
  if (lastIndex < content.length) {
    parts.push(
      <TextChunk key={`text-${lastIndex}`} text={content.slice(lastIndex)} />,
    )
  }

  return <div className="formatted-body">{parts}</div>
}

function CodeSnippet({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignore
    }
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-lang">{language}</span>
        <button
          type="button"
          className="code-copy-btn"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="code-block-pre">
        <code>{code.trimEnd()}</code>
      </pre>
    </div>
  )
}

function TextChunk({ text }: { text: string }) {
  const lines = text.split('\n')

  return (
    <div className="prose-chunk">
      {lines.map((line, idx) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h4 key={idx} className="prose-h3">{line.replace('### ', '')}</h4>
        }
        if (line.startsWith('## ')) {
          return <h3 key={idx} className="prose-h2">{line.replace('## ', '')}</h3>
        }
        if (line.startsWith('# ')) {
          return <h2 key={idx} className="prose-h1">{line.replace('# ', '')}</h2>
        }

        // Bullet lists
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          return (
            <div key={idx} className="prose-bullet">
              <span className="bullet-dot">•</span>
              <span className="bullet-content">{renderInline(line.trim().substring(2))}</span>
            </div>
          )
        }

        // Numbered lists
        const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/)
        if (numMatch) {
          return (
            <div key={idx} className="prose-numbered">
              <span className="numbered-prefix">{numMatch[1]}.</span>
              <span className="numbered-content">{renderInline(numMatch[2])}</span>
            </div>
          )
        }

        // Blockquotes
        if (line.startsWith('> ')) {
          return (
            <blockquote key={idx} className="prose-quote">
              {renderInline(line.replace('> ', ''))}
            </blockquote>
          )
        }

        // Empty line
        if (!line.trim()) {
          return <div key={idx} className="prose-spacer" />
        }

        // Regular paragraph line
        return <p key={idx} className="prose-p">{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(str: string): React.ReactNode[] {
  // Bold **text**
  // Inline `code`
  const regex = /(\*\*.*?\*\*|`.*?`)/g
  const result: React.ReactNode[] = []
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = regex.exec(str)) !== null) {
    if (m.index > lastIdx) {
      result.push(str.substring(lastIdx, m.index))
    }
    const token = m[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      result.push(<strong key={m.index}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      result.push(<code key={m.index} className="inline-code">{token.slice(1, -1)}</code>)
    }
    lastIdx = m.index + token.length
  }
  if (lastIdx < str.length) {
    result.push(str.substring(lastIdx))
  }
  return result
}

export function MessageView({ message }: MessageViewProps) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [showThought, setShowThought] = useState(false)

  const isUser = message.role === 'user'

  // Extract <think> or <thought> block if present
  let thoughtContent: string | null = null
  let mainContent = message.content

  const thinkMatch = message.content.match(/<(think|thought)>([\s\S]*?)<\/\1>/i)
  if (thinkMatch) {
    thoughtContent = thinkMatch[2].trim()
    mainContent = message.content.replace(/<(think|thought)>[\s\S]*?<\/\1>/i, '').trim()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mainContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignore
    }
  }

  return (
    <article className={`message-item ${isUser ? 'user-message' : 'assistant-message'}`}>
      <div className="message-container">
        {/* Avatar */}
        <div className={`message-avatar ${isUser ? 'user-avatar' : 'bot-avatar'}`}>
          {isUser ? <UserIcon size={14} /> : <img src="/logo.png" alt="Nvirya" className="bot-avatar-img" />}
        </div>

        <div className="message-content-wrapper">
          {/* Header meta */}
          <div className="message-header-meta">
            <span className="message-author">{isUser ? 'You' : 'Nvirya AI'}</span>
            <span className="message-timestamp">{formatDate(message.createdAt)}</span>
          </div>

          {/* Thought block (Antigravity style) */}
          {thoughtContent && (
            <div className="thought-trace-box">
              <button
                type="button"
                className="thought-trace-toggle"
                onClick={() => setShowThought((prev) => !prev)}
                aria-expanded={showThought}
              >
                <Brain size={13} className="thought-icon" />
                <span>Thinking Process</span>
                {showThought ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
              {showThought && (
                <div className="thought-trace-body animate-fade-in">
                  <p>{thoughtContent}</p>
                </div>
              )}
            </div>
          )}

          {/* Body content */}
          <div className="message-text-body">
            {mainContent ? (
              <FormattedContent content={mainContent} />
            ) : message.streaming ? (
              <div className="streaming-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            ) : null}
          </div>

          {/* Actions for Assistant */}
          {!isUser && mainContent && (
            <div className="message-actions-bar">
              <button
                type="button"
                className={`action-btn ${copied ? 'active' : ''}`}
                onClick={handleCopy}
                title="Copy response"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                className={`action-btn icon-only ${feedback === 'up' ? 'active text-success' : ''}`}
                onClick={() => setFeedback((f) => (f === 'up' ? null : 'up'))}
                title="Good response"
              >
                <ThumbsUp size={13} />
              </button>

              <button
                type="button"
                className={`action-btn icon-only ${feedback === 'down' ? 'active text-danger' : ''}`}
                onClick={() => setFeedback((f) => (f === 'down' ? null : 'down'))}
                title="Bad response"
              >
                <ThumbsDown size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

