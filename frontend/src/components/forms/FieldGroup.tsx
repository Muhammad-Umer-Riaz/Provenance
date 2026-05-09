import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FieldGroupProps {
  number: string
  title: string
  tag?: string
  children: ReactNode
  className?: string
}

export function FieldGroup({ number, title, tag, children, className }: FieldGroupProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-5', className)}>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="font-mono text-xs text-muted-foreground">§ {number}</span>
        <span className="text-sm font-medium">{title}</span>
        {tag && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {tag}
          </span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}
