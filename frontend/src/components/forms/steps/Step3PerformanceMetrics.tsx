import type { Control, FieldErrors } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { NumberField } from '../fields/NumberField'
import { IntegerField } from '../fields/IntegerField'
import { MultiEnumField } from '../fields/MultiEnumField'
import { FieldGroup } from '../FieldGroup'
import type { IntakeFieldSchema } from '@/types/template'

interface Props {
  control: Control<IntakeFormValues>
  errors: FieldErrors<IntakeFormValues>
  watch: IntakeFormValues
}

const CERT_SCHEMA: IntakeFieldSchema = {
  type: 'multi_enum',
  required: true,
  label: 'Certifications held',
  values: ['ISO 9001:2015', 'ISO 14001:2015', 'IATF 16949', 'EN 9100', 'ISO 45001', 'ISO 27001', 'None'],
}

const mkNum = (label: string, required = true, min = 0, max = 100): IntakeFieldSchema => ({
  type: 'number', required, label, validation: { min, max },
})
const mkInt = (label: string, required = true, min = 0): IntakeFieldSchema => ({
  type: 'integer', required, label, validation: { min },
})

export function Step3PerformanceMetrics({ control }: Props) {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Performance & certifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Current period operational metrics and certifications. Optional thresholds override template defaults if present.
        </p>
      </div>

      <FieldGroup number="01" title="Performance metrics" tag="current review period">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            name="otd_rate_pct"
            schema={mkNum('On-time delivery rate')}
            control={control}
            fieldId="otd_rate_pct"
            placeholder="%"
          />
          <NumberField
            name="defect_rate_pct"
            schema={mkNum('Incoming defect / rejection rate')}
            control={control}
            fieldId="defect_rate_pct"
            placeholder="%"
          />
          <NumberField
            name="invoice_accuracy_pct"
            schema={mkNum('Invoice accuracy')}
            control={control}
            fieldId="invoice_accuracy_pct"
            placeholder="%"
          />
          <IntegerField
            name="open_ncr_count"
            schema={mkInt('Open NCR count')}
            control={control}
            fieldId="open_ncr_count"
          />
          <NumberField
            name="ncr_avg_close_days"
            schema={mkNum('Average NCR close time', false, 0, 99999)}
            control={control}
            fieldId="ncr_avg_close_days"
            placeholder="days"
          />
        </div>
      </FieldGroup>

      <FieldGroup number="02" title="Certifications" tag="multi-select">
        <MultiEnumField name="certifications_held" schema={CERT_SCHEMA} control={control} />
      </FieldGroup>

      <FieldGroup number="03" title="SLA pass thresholds" tag="optional · template defaults used if blank">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            name="otd_pass_target"
            schema={mkNum('OTD pass threshold', false)}
            control={control}
            fieldId="otd_pass_target"
            placeholder="default 90 %"
          />
          <NumberField
            name="defect_pass_target"
            schema={mkNum('Defect rate pass threshold', false)}
            control={control}
            fieldId="defect_pass_target"
            placeholder="default 1.5 %"
          />
          <NumberField
            name="invoice_pass_target"
            schema={mkNum('Invoice accuracy pass threshold', false)}
            control={control}
            fieldId="invoice_pass_target"
            placeholder="default 95 %"
          />
          <IntegerField
            name="ncr_count_pass_target"
            schema={mkInt('Max open NCRs to pass', false)}
            control={control}
            fieldId="ncr_count_pass_target"
            placeholder="default 2"
          />
          <NumberField
            name="ncr_close_pass_target"
            schema={mkNum('NCR close time pass threshold', false, 0, 99999)}
            control={control}
            fieldId="ncr_close_pass_target"
            placeholder="default 14 days"
          />
        </div>
      </FieldGroup>
    </div>
  )
}
