import { NumberField } from './NumberField'
import type { Control, FieldValues, Path } from 'react-hook-form'
import type { IntakeFieldSchema } from '@/types/template'

interface Props<T extends FieldValues> {
  name: Path<T>
  schema: IntakeFieldSchema
  control: Control<T>
  fieldId?: string
  placeholder?: string
}

export function IntegerField<T extends FieldValues>({ name, schema, control, fieldId, placeholder }: Props<T>) {
  return <NumberField name={name} schema={schema} control={control} step={1} fieldId={fieldId} placeholder={placeholder} />
}
