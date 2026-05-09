import { cn } from '@/lib/utils'

interface ScoreButtonsProps {
  value: number | null
  onChange: (v: number) => void
  disabled?: boolean
}

export function ScoreButtons({ value, onChange, disabled }: ScoreButtonsProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={cn(
            'h-7 w-7 rounded text-xs font-medium transition-colors',
            value === n
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
