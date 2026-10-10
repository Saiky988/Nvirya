import { Moon, Sun } from 'lucide-react'

interface ThemeToggleProps {
  theme: 'dark' | 'light'
  onToggle: () => void
  compact?: boolean
}

export function ThemeToggle({ theme, onToggle, compact = false }: ThemeToggleProps) {
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${compact ? 'compact' : ''}`}
      onClick={onToggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <div className="theme-toggle-track">
        <span className={`theme-toggle-icon sun-icon ${!isDark ? 'active' : ''}`}>
          <Sun size={15} />
        </span>
        <span className={`theme-toggle-icon moon-icon ${isDark ? 'active' : ''}`}>
          <Moon size={15} />
        </span>
      </div>
      {!compact && (
        <span className="theme-toggle-label">
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </button>
  )
}
