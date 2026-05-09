import type { Control, FieldErrors } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { RiskRegisterTable } from '../tables/RiskRegisterTable'
import { CARTable } from '../tables/CARTable'
import { Separator } from '@/components/ui/separator'

interface Props {
  control: Control<IntakeFormValues>
  errors: FieldErrors<IntakeFormValues>
}

export function Step5RiskAndCARs({ control, errors }: Props) {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-medium">Risk register</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Identify all material risks. Priority = Likelihood × Impact.
          </p>
        </div>
        <RiskRegisterTable control={control} />
        {errors.risk_register && typeof errors.risk_register.message === 'string' && (
          <p className="text-xs text-destructive">{errors.risk_register.message}</p>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-medium">Corrective action requests</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add any CARs issued during this evaluation.
          </p>
        </div>
        <CARTable control={control} />
      </section>
    </div>
  )
}
