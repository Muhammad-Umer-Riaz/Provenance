import { useFieldArray, type Control, type FieldErrors } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { ScoreButtons } from '@/components/ui/score-buttons'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  control: Control<IntakeFormValues>
  errors: FieldErrors<IntakeFormValues>
}

export function Step4AuditScorecard({ control, errors }: Props) {
  const { fields, update } = useFieldArray({ control, name: 'audit_scores' })

  const totalWeight = fields.reduce((s, r) => s + (r.weight ?? 0), 0)
  const weightOk = Math.abs(totalWeight - 1.0) < 0.001
  const previewScore = fields.reduce((s, r) => {
    const sc = typeof r.score === 'number' ? r.score : 0
    return s + r.weight * sc
  }, 0)
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Audit scorecard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Score each criterion 1–5. Weights must sum to 1.00. Adjust weights only if the template default doesn't match this evaluation.
        </p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2rem_1fr_5rem_9rem_1fr] gap-3 border-b bg-muted/50 px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">#</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Criterion</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Weight</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Score (1–5)</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Notes</span>
        </div>

        {/* Rows */}
        {fields.map((row, i) => (
          <div
            key={row.id}
            className={cn(
              'grid grid-cols-[2rem_1fr_5rem_9rem_1fr] items-center gap-3 px-4 py-3',
              i < fields.length - 1 && 'border-b',
            )}
          >
            <span className="text-xs text-muted-foreground">{i + 1}</span>
            <span className="text-sm">{row.criterion}</span>
            <Input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={row.weight}
              onChange={e => update(i, { ...row, weight: Number(e.target.value) })}
              className="h-7 px-2 text-xs"
            />
            <ScoreButtons
              value={typeof row.score === 'number' ? row.score : null}
              onChange={v => update(i, { ...row, score: v })}
            />
            <Input
              type="text"
              value={row.notes ?? ''}
              placeholder="optional notes"
              onChange={e => update(i, { ...row, notes: e.target.value })}
              className="h-7 px-2 text-xs"
            />
          </div>
        ))}

        {/* Footer summary row */}
        <div className="grid grid-cols-[2rem_1fr_5rem_9rem_1fr] items-center gap-3 border-t bg-muted/30 px-4 py-2">
          <span />
          <span className="text-[11px] text-muted-foreground">weighted composite (calculated downstream)</span>
          <span className={cn('font-mono text-xs', weightOk ? 'text-emerald-600' : 'text-destructive')}>
            ∑ {totalWeight.toFixed(2)} {weightOk ? '✓' : '✗'}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            preview {previewScore.toFixed(2)} / 5.00
          </span>
          <span className="text-[10px] text-muted-foreground/60">preview only · backend recalculates</span>
        </div>
      </div>

      {errors.audit_scores && (
        <p className="text-xs text-destructive">
          Please score all criteria before continuing.
        </p>
      )}
    </div>
  )
}
