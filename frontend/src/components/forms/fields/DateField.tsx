import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { IntakeFieldSchema } from '@/types/template'

interface Props<T extends FieldValues> {
  name: Path<T>
  schema: IntakeFieldSchema
  control: Control<T>
}

export function DateField<T extends FieldValues>({ name, schema, control }: Props<T>) {
  return (
    <Controller
      name={name}
      control={control}
      defaultValue={'' as never}
      render={({ field, fieldState }) => (
        <div className="space-y-1.5">
          <Label htmlFor={name}>
            {schema.label}
            {schema.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={name}
            type="date"
            {...field}
            value={field.value ?? ''}
            className={fieldState.error ? 'border-destructive' : ''}
          />
          {fieldState.error && (
            <p className="text-xs text-destructive">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  )
}
