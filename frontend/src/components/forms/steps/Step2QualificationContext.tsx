import type { Control, FieldErrors } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { EnumField } from '../fields/EnumField'
import { NumberField } from '../fields/NumberField'
import { ConditionalField } from '../fields/ConditionalField'
import type { IntakeFieldSchema } from '@/types/template'

interface Props {
  control: Control<IntakeFormValues>
  errors: FieldErrors<IntakeFormValues>
  watch: IntakeFormValues
}

const QUALIFICATION_TYPE_SCHEMA: IntakeFieldSchema = {
  type: 'enum',
  required: true,
  label: 'Qualification type',
  values: ['Initial qualification', 'Re-qualification', 'For-cause review'],
}

const PREVIOUS_VERDICT_SCHEMA: IntakeFieldSchema = {
  type: 'enum',
  required: false,
  label: 'Previous qualification verdict',
  values: ['Preferred', 'Conditional', 'Probationary', 'Rejected'],
  condition: "qualification_type != 'Initial qualification'",
}

const PREV_SCORE_SCHEMA: IntakeFieldSchema = {
  type: 'number',
  required: false,
  label: 'Previous composite score',
  validation: { min: 0.0, max: 5.0 },
  condition: "qualification_type != 'Initial qualification'",
}

const PREV_OTD_SCHEMA: IntakeFieldSchema = {
  type: 'number',
  required: false,
  label: 'Previous period OTD rate (%)',
  validation: { min: 0, max: 100 },
  condition: "qualification_type != 'Initial qualification'",
}

const PREV_DEFECT_SCHEMA: IntakeFieldSchema = {
  type: 'number',
  required: false,
  label: 'Previous period defect rate (%)',
  validation: { min: 0, max: 100 },
  condition: "qualification_type != 'Initial qualification'",
}

const PREV_INVOICE_SCHEMA: IntakeFieldSchema = {
  type: 'number',
  required: false,
  label: 'Previous period invoice accuracy (%)',
  validation: { min: 0, max: 100 },
  condition: "qualification_type != 'Initial qualification'",
}

export function Step2QualificationContext({ control, watch }: Props) {
  return (
    <div className="space-y-5">
      <EnumField name="qualification_type" schema={QUALIFICATION_TYPE_SCHEMA} control={control} />

      <ConditionalField condition={PREVIOUS_VERDICT_SCHEMA.condition} watchValues={watch as unknown as Partial<Record<string, unknown>>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t">
          <p className="sm:col-span-2 text-sm text-muted-foreground">
            Previous qualification data (used to generate trend comparisons)
          </p>
          <EnumField name="previous_verdict" schema={PREVIOUS_VERDICT_SCHEMA} control={control} />
          <NumberField name="previous_composite_score" schema={PREV_SCORE_SCHEMA} control={control} />
          <NumberField name="prev_otd_rate_pct" schema={PREV_OTD_SCHEMA} control={control} />
          <NumberField name="prev_defect_rate_pct" schema={PREV_DEFECT_SCHEMA} control={control} />
          <NumberField name="prev_invoice_accuracy_pct" schema={PREV_INVOICE_SCHEMA} control={control} />
        </div>
      </ConditionalField>
    </div>
  )
}
