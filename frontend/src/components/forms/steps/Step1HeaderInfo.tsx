import type { Control, FieldErrors } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { StringField } from '../fields/StringField'
import { EnumField } from '../fields/EnumField'
import { FieldGroup } from '../FieldGroup'
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

export function Step1HeaderInfo({ control }: Props) {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Header info</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Identifies the supplier, evaluator, and the period this report covers.
        </p>
      </div>

      <FieldGroup number="01" title="Identity" tag="who & where">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StringField
            name="supplier_name"
            schema={{ type: 'string', required: true, label: 'Supplier name' }}
            control={control}
            fieldId="supplier_name"
          />
          <StringField
            name="supplier_country"
            schema={{ type: 'string', required: true, label: 'Country of operation' }}
            control={control}
            fieldId="supplier_country"
          />
        </div>
        <EnumField
          name="commodity_category"
          schema={COMMODITY_SCHEMA}
          control={control}
          fieldId="commodity_category"
        />
      </FieldGroup>

      <FieldGroup number="02" title="Scope" tag="what & when">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StringField
            name="evaluator_name"
            schema={{ type: 'string', required: true, label: 'Evaluator name' }}
            control={control}
            fieldId="evaluator_name"
          />
          <StringField
            name="review_period"
            schema={{ type: 'string', required: true, label: 'Review period' }}
            control={control}
            fieldId="review_period"
            placeholder="e.g. Q1 2026"
          />
        </div>
      </FieldGroup>

      <FieldGroup number="03" title="Contact & identifiers" tag="optional">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StringField
            name="supplier_contact_name"
            schema={{ type: 'string', required: false, label: 'Supplier contact name' }}
            control={control}
            fieldId="supplier_contact_name"
            placeholder="optional"
          />
          <StringField
            name="supplier_contact_title"
            schema={{ type: 'string', required: false, label: 'Contact title / role' }}
            control={control}
            fieldId="supplier_contact_title"
            placeholder="optional"
          />
        </div>
        <StringField
          name="duns_number"
          schema={{ type: 'string', required: false, label: 'DUNS number' }}
          control={control}
          fieldId="duns_number"
          placeholder="optional · 9 digits"
        />
      </FieldGroup>
    </div>
  )
}
