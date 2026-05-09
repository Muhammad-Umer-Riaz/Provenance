import { Controller } from 'react-hook-form'
import type { Control, FieldErrors } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { EnumField } from '../fields/EnumField'
import { NumberField } from '../fields/NumberField'
import { ConditionalField } from '../fields/ConditionalField'
import { FieldGroup } from '../FieldGroup'
import { cn } from '@/lib/utils'
import type { IntakeFieldSchema } from '@/types/template'

interface Props {
  control: Control<IntakeFormValues>
  errors: FieldErrors<IntakeFormValues>
  watch: IntakeFormValues
}

const QUAL_TYPES = [
  {
    value: 'Initial qualification',
    label: 'Initial qualification',
    description: 'first-time review · no prior data',
  },
  {
    value: 'Re-qualification',
    label: 'Re-qualification',
    description: 'periodic · uses prior baseline',
  },
  {
    value: 'For-cause review',
    label: 'For-cause review',
    description: 'triggered · investigates a specific incident',
  },
]

const PREVIOUS_VERDICT_SCHEMA: IntakeFieldSchema = {
  type: 'enum',
  required: false,
  label: 'Previous verdict',
  values: ['Preferred', 'Conditional', 'Probationary', 'Rejected'],
}

const PREV_SCORE_SCHEMA: IntakeFieldSchema = {
  type: 'number',
  required: false,
  label: 'Previous composite score',
  validation: { min: 0.0, max: 5.0 },
}

const PREV_OTD_SCHEMA: IntakeFieldSchema = {
  type: 'number',
  required: false,
  label: 'Previous OTD rate',
  validation: { min: 0, max: 100 },
}

const PREV_DEFECT_SCHEMA: IntakeFieldSchema = {
  type: 'number',
  required: false,
  label: 'Previous defect rate',
  validation: { min: 0, max: 100 },
}

const PREV_INVOICE_SCHEMA: IntakeFieldSchema = {
  type: 'number',
  required: false,
  label: 'Previous invoice accuracy',
  validation: { min: 0, max: 100 },
}

export function Step2QualificationContext({ control, watch }: Props) {
  const isNotInitial = watch.qualification_type && watch.qualification_type !== 'Initial qualification'

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Qualification context</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Defines the kind of review and, if applicable, the prior performance baseline used for trend comparison.
        </p>
      </div>

      <FieldGroup number="01" title="Review type" tag="how this report is framed">
        <Controller
          name="qualification_type"
          control={control}
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">Qualification type</span>
                <span className="font-mono text-[10px] text-muted-foreground">req</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">qualification_type</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {QUAL_TYPES.map(qt => (
                  <button
                    key={qt.value}
                    type="button"
                    onClick={() => field.onChange(qt.value)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      field.value === qt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-primary/50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'h-3.5 w-3.5 rounded-full border-2',
                          field.value === qt.value
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground',
                        )}
                      />
                      <span className="text-sm font-medium">{qt.label}</span>
                    </div>
                    <p className="mt-1 pl-5 text-[11px] text-muted-foreground">{qt.description}</p>
                  </button>
                ))}
              </div>
              {fieldState.error && (
                <p className="text-xs text-destructive">{fieldState.error.message}</p>
              )}
            </div>
          )}
        />
      </FieldGroup>

      <ConditionalField
        condition="qualification_type != 'Initial qualification'"
        watchValues={watch as unknown as Partial<Record<string, unknown>>}
      >
        <FieldGroup
          number="02"
          title="Previous period baseline"
          tag="conditional"
        >
          <div className="mb-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Used to generate trend comparisons in S3 narrative. Skip individual fields if data is
            unavailable — engine will note "n/a".
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EnumField
              name="previous_verdict"
              schema={PREVIOUS_VERDICT_SCHEMA}
              control={control}
              fieldId="previous_verdict"
            />
            <NumberField
              name="previous_composite_score"
              schema={PREV_SCORE_SCHEMA}
              control={control}
              fieldId="previous_composite_score"
            />
            <NumberField
              name="prev_otd_rate_pct"
              schema={PREV_OTD_SCHEMA}
              control={control}
              fieldId="prev_otd_rate_pct"
            />
            <NumberField
              name="prev_defect_rate_pct"
              schema={PREV_DEFECT_SCHEMA}
              control={control}
              fieldId="prev_defect_rate_pct"
            />
            <NumberField
              name="prev_invoice_accuracy_pct"
              schema={PREV_INVOICE_SCHEMA}
              control={control}
              fieldId="prev_invoice_accuracy_pct"
            />
          </div>
        </FieldGroup>
      </ConditionalField>
    </div>
  )
}
