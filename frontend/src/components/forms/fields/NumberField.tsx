import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { IntakeFieldSchema } from '@/types/template'

interface Props<T extends FieldValues> {
  name: Path<T>
  schema: IntakeFieldSchema
  control: Control<T>
  step?: number
}

export function NumberField<T extends FieldValues>({ name, schema, control, step = 'any' as unknown as number }: Props<T>) {
  const { min, max } = schema.validation ?? {}

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div className="space-y-1.5">
          <Label htmlFor={name}>
            {schema.label}
            {schema.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={name}
            type="number"
            step={step}
            min={min}
            max={max}
            value={field.value ?? ''}
            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
            onBlur={field.onBlur}
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
