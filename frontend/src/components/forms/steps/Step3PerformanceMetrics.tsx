import type { Control, FieldErrors } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { NumberField } from '../fields/NumberField'
import { IntegerField } from '../fields/IntegerField'
import { MultiEnumField } from '../fields/MultiEnumField'
import type { IntakeFieldSchema } from '@/types/template'

interface Props {
  control: Control<IntakeFormValues>
  errors: FieldErrors<IntakeFormValues>
  watch: IntakeFormValues
}

const CERT_SCHEMA: IntakeFieldSchema = {
  type: 'multi_enum',
  required: false,
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
    <div className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Performance metrics
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <NumberField name="otd_rate_pct" schema={mkNum('On-time delivery rate (%)')} control={control} />
          <NumberField name="defect_rate_pct" schema={mkNum('Incoming defect / rejection rate (%)')} control={control} />
          <NumberField name="invoice_accuracy_pct" schema={mkNum('Invoice accuracy (%)')} control={control} />
          <IntegerField name="open_ncr_count" schema={mkInt('Open NCR count')} control={control} />
          <NumberField name="ncr_avg_close_days" schema={mkNum('Average NCR close time (days)', false, 0, 99999)} control={control} />
        </div>
      </section>

      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Certifications
        </h3>
        <MultiEnumField name="certifications_held" schema={CERT_SCHEMA} control={control} />
      </section>

      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          SLA pass thresholds — leave blank to use template defaults
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <NumberField name="otd_pass_target" schema={mkNum('OTD pass threshold (%) — blank = 90% default', false)} control={control} />
          <NumberField name="defect_pass_target" schema={mkNum('Defect rate pass threshold (%) — blank = 1.5% default', false)} control={control} />
          <NumberField name="invoice_pass_target" schema={mkNum('Invoice accuracy pass threshold (%) — blank = 95% default', false)} control={control} />
          <IntegerField name="ncr_count_pass_target" schema={mkInt('Max open NCRs to pass — blank = 2 default', false)} control={control} />
          <NumberField name="ncr_close_pass_target" schema={mkNum('NCR close time pass threshold (days) — blank = 14 default', false, 0, 99999)} control={control} />
        </div>
      </section>
    </div>
  )
}
