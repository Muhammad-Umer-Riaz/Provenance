import type { Control, FieldErrors } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { RiskRegisterTable } from '../tables/RiskRegisterTable'
import { CARTable } from '../tables/CARTable'
import { FieldGroup } from '../FieldGroup'

interface Props {
  control: Control<IntakeFormValues>
  errors: FieldErrors<IntakeFormValues>
}

export function Step5RiskAndCARs({ control, errors }: Props) {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Risk & corrective actions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Material risks identified during this review, plus any corrective action requests issued.
        </p>
      </div>

      <FieldGroup
        number="01"
        title="Risk register"
        tag="req · at least one required · priority = likelihood × impact"
      >
        <RiskRegisterTable control={control} />
        {errors.risk_register && typeof errors.risk_register.message === 'string' && (
          <p className="text-xs text-destructive">{errors.risk_register.message}</p>
        )}
      </FieldGroup>

      <FieldGroup
        number="02"
        title="Corrective actions"
        tag="opt · add only if CARs were issued"
      >
        <CARTable control={control} />
      </FieldGroup>
    </div>
  )
}
