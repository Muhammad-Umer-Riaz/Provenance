import type { Control, FieldErrors } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { AuditScorecardTable } from '../tables/AuditScorecardTable'

interface Props {
  control: Control<IntakeFormValues>
  errors: FieldErrors<IntakeFormValues>
}

export function Step4AuditScorecard({ control, errors }: Props) {
  const hasScoreErrors = errors.audit_scores != null
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Score each audit criterion from 1 (poor) to 5 (excellent). Adjust weights if needed — they must sum to 1.0.
      </p>
      <AuditScorecardTable control={control} />
      {hasScoreErrors && (
        <p className="text-xs text-destructive">Please enter a score (1–5) for every criterion before continuing.</p>
      )}
    </div>
  )
}
