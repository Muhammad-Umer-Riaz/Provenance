import { useEffect, useState } from 'react'

interface AutosaveIndicatorProps {
  lastSavedAt: Date | null
  isSaving: boolean
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

export function AutosaveIndicator({ lastSavedAt, isSaving }: AutosaveIndicatorProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  if (isSaving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        saving...
      </span>
    )
  }

  if (!lastSavedAt) return null

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      autosaved · {timeAgo(lastSavedAt)}
    </span>
  )
}
