import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  Brain,
  Check,
  ChevronDown,
  Cpu,
  Search,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react'
import type { ModelCard } from '../types'

interface ModelPickerProps {
  selectedModel: string
  onSelectModel: (modelId: string) => void
  models: ModelCard[]
}

interface ModelMeta {
  title: string
  badge?: string
  desc: string
  icon: typeof Sparkles
  color: string
}

function getModelMeta(id: string): ModelMeta {
  const lower = id.toLowerCase()
  if (lower.includes('auto') || lower === 'nvirya-auto') {
    return {
      title: 'Nvirya Auto',
      badge: 'Recommended',
      desc: 'Dynamically routes prompts to the highest-performing engine',
      icon: Sparkles,
      color: 'var(--accent-primary)',
    }
  }
  if (lower.includes('deepseek') || lower.includes('r1')) {
    return {
      title: id.replace('nvirya-', '').replace(/-/g, ' ').toUpperCase(),
      badge: 'Reasoning',
      desc: 'Deep multi-step reasoning, mathematical & logic analysis',
      icon: Brain,
      color: '#38bdf8',
    }
  }
  if (lower.includes('flash') || lower.includes('mini') || lower.includes('turbo')) {
    return {
      title: id.replace('nvirya-', '').replace(/-/g, ' '),
      badge: 'Ultra Fast',
      desc: 'Optimized for low-latency responses and concise tasks',
      icon: Zap,
      color: '#eab308',
    }
  }
  if (lower.includes('claude') || lower.includes('sonnet') || lower.includes('opus')) {
    return {
      title: id.replace('nvirya-', '').replace(/-/g, ' '),
      badge: 'Advanced',
      desc: 'Nuanced writing, large context comprehension & thoughtful code',
      icon: Cpu,
      color: '#f97316',
    }
  }
  if (lower.includes('code') || lower.includes('coder') || lower.includes('dev')) {
    return {
      title: id.replace('nvirya-', '').replace(/-/g, ' '),
      badge: 'Coding',
      desc: 'Specialized code generation, debugging, and refactoring',
      icon: Terminal,
      color: '#10b981',
    }
  }
  return {
    title: id.replace('nvirya-', '').replace(/-/g, ' '),
    desc: 'General intelligence and instruction following',
    icon: Bot,
    color: 'var(--text-secondary)',
  }
}

export function ModelPicker({ selectedModel, onSelectModel, models }: ModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const activeMeta = getModelMeta(selectedModel)
  const ActiveIcon = activeMeta.icon

  // Fallback if models array is empty
  const availableModels = models.length ? models : [{ id: selectedModel } as ModelCard]

  const filteredModels = availableModels.filter((m) =>
    m.id.toLowerCase().includes(search.toLowerCase()),
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="model-picker-container">
      <button
        ref={triggerRef}
        type="button"
        className={`model-picker-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="model-trigger-icon" style={{ color: activeMeta.color }}>
          <ActiveIcon size={14} />
        </span>
        <span className="model-trigger-name">{activeMeta.title}</span>
        {activeMeta.badge && (
          <span className="model-trigger-badge">{activeMeta.badge}</span>
        )}
        <ChevronDown size={13} className={`chevron ${isOpen ? 'rotate' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="model-picker-scrim"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div ref={menuRef} className="model-picker-dropdown animate-fade-in" role="listbox">
            <div className="model-picker-header">
            <span className="picker-title">Select Model</span>
            {availableModels.length > 4 && (
              <div className="model-search-box">
                <Search size={13} />
                <input
                  type="text"
                  placeholder="Filter models..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="model-options-list">
            {filteredModels.map((model) => {
              const meta = getModelMeta(model.id)
              const Icon = meta.icon
              const isSelected = model.id === selectedModel

              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`model-option-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectModel(model.id)
                    setIsOpen(false)
                  }}
                >
                  <div className="model-option-icon" style={{ color: meta.color }}>
                    <Icon size={16} />
                  </div>
                  <div className="model-option-text">
                    <div className="model-option-headline">
                      <span className="model-option-title">{meta.title}</span>
                      {meta.badge && <span className="model-badge">{meta.badge}</span>}
                    </div>
                    <span className="model-option-desc">{meta.desc}</span>
                  </div>
                  {isSelected && (
                    <div className="model-selected-check">
                      <Check size={14} />
                    </div>
                  )}
                </button>
              )
            })}
            {filteredModels.length === 0 && (
              <div className="model-no-results">No models match &ldquo;{search}&rdquo;</div>
            )}
          </div>
        </div>
      </>
    )}
    </div>
  )
}

