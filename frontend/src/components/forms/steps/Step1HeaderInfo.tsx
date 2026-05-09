import type { Control, FieldErrors } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { StringField } from '../fields/StringField'
import { EnumField } from '../fields/EnumField'
import type { IntakeFieldSchema } from '@/types/template'

interface Props {
  control: Control<IntakeFormValues>
  errors: FieldErrors<IntakeFormValues>
  watch: IntakeFormValues
}

const COMMODITY_SCHEMA: IntakeFieldSchema = {
  type: 'enum',
  required: true,
  label: 'Commodity category',
  values: [
    'Precision machined components',
    'Electronic assemblies',
    'Raw materials — metals',
    'Raw materials — polymers',
    'Packaging materials',
    'Logistics services',
    'Software & IT services',
  ],
}

const STRING_SCHEMAS: Record<string, IntakeFieldSchema> = {
  supplier_name: { type: 'string', required: true, label: 'Supplier name' },
  supplier_country: { type: 'string', required: true, label: 'Country of operation' },
  supplier_contact_name: { type: 'string', required: false, label: 'Supplier contact name' },
  supplier_contact_title: { type: 'string', required: false, label: 'Supplier contact title / role' },
  evaluator_name: { type: 'string', required: true, label: 'Evaluator name' },
  review_period: { type: 'string', required: true, label: 'Review period (e.g. Q1 2026 / Jan–Mar 2026)' },
  duns_number: { type: 'string', required: false, label: 'DUNS number (optional)' },
}

export function Step1HeaderInfo({ control }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <StringField name="supplier_name" schema={STRING_SCHEMAS.supplier_name} control={control} />
      <StringField name="supplier_country" schema={STRING_SCHEMAS.supplier_country} control={control} />
      <EnumField name="commodity_category" schema={COMMODITY_SCHEMA} control={control} />
      <StringField name="evaluator_name" schema={STRING_SCHEMAS.evaluator_name} control={control} />
      <div className="sm:col-span-2">
        <StringField name="review_period" schema={STRING_SCHEMAS.review_period} control={control} />
      </div>
      <StringField name="supplier_contact_name" schema={STRING_SCHEMAS.supplier_contact_name} control={control} />
      <StringField name="supplier_contact_title" schema={STRING_SCHEMAS.supplier_contact_title} control={control} />
      <StringField name="duns_number" schema={STRING_SCHEMAS.duns_number} control={control} />
    </div>
  )
}
