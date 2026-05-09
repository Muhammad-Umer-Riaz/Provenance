import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepProgressCount {
  filled: number
  total: number
}

interface IntakeSidebarProps {
  currentStep: number
  progressCounts: StepProgressCount[]
}

const STEPS = [
  { label: 'Header info' },
  { label: 'Qualification' },
  { label: 'Performance' },
  { label: 'Audit scorecard' },
  { label: 'Risk & CARs' },
]

const STEP_META: {
  description: string
  downstream: string[]
}[] = [
  {
    description:
      'These 8 fields define the report header and feed downstream lookups (commodity_category gates risk profile; review_period drives all date-bound calculations).',
    downstream: ['$1 report header', '$3 risk classifier inputs', 'all narrative_llm fields'],
  },
  {
    description:
      'Sets the review type and captures prior-period baseline. The qualifier type controls which conditional fields are shown and gates the trend-analysis narrative.',
    downstream: ['S2 qualification summary', 'classifier (verdict!)', 'narrative_llm (trend analysis)'],
  },
  {
    description:
      'Current-period operational metrics and certifications. Optional thresholds override template defaults if present.',
    downstream: ['calculator fields (5)', 'classifier (verdict!)', 'S3 metrics table'],
  },
  {
    description:
      'Score each criterion 1–5. Weights must sum to 1.00. Adjust weights only if the template default doesn\'t match this evaluation.',
    downstream: ['composite_score (calculator)', 'verdict (classifier)', 'audit narrative'],
  },
  {
    description:
      'Material risks identified during this review, plus any corrective action requests issued.',
    downstream: ['S5 risk register', 'S5 CAR table', 'risk classifier · narrative'],
  },
]

export function IntakeSidebar({ currentStep, progressCounts }: IntakeSidebarProps) {
  const meta = STEP_META[currentStep - 1]

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 pt-1">
      {/* THIS STEP */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          This step
        </p>
        <p className="text-xs leading-relaxed text-foreground/80">{meta.description}</p>
      </div>

      {/* PROGRESS */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Progress
        </p>
        <ul className="space-y-2">
          {STEPS.map((step, i) => {
            const stepNum = i + 1
            const counts = progressCounts[i]
            const isComplete = counts && counts.filled >= counts.total && counts.total > 0
            const isCurrent = stepNum === currentStep
            const isPast = stepNum < currentStep

            return (
              <li key={stepNum} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
                      isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : (isPast || isComplete)
                          ? 'bg-emerald-500 text-white'
                          : 'border border-border bg-background text-muted-foreground',
                    )}
                  >
                    {(isPast || isComplete) && !isCurrent ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : (
                      String(stepNum).padStart(2, '0')
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {counts && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {counts.filled}/{counts.total}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* DOWNSTREAM */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Downstream
        </p>
        <p className="mb-2 text-[10px] text-muted-foreground">This step feeds:</p>
        <ul className="space-y-1">
          {meta.downstream.map(item => (
            <li key={item} className="flex items-start gap-1.5 text-[11px] text-foreground/70">
              <span className="mt-0.5 text-muted-foreground">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
