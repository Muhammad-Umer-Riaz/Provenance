import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import type { IntakeFieldSchema } from '@/types/template'

interface Props<T extends FieldValues> {
  name: Path<T>
  schema: IntakeFieldSchema
  control: Control<T>
  fieldId?: string
  placeholder?: string
}

export function StringField<T extends FieldValues>({ name, schema, control, fieldId, placeholder }: Props<T>) {
  return (
    <Controller
      name={name}
      control={control}
      defaultValue={'' as never}
      render={({ field, fieldState }) => (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">
              {schema.label}
              {' '}
              <span className="font-mono text-[10px] text-muted-foreground">
                {schema.required ? 'req' : 'opt'}
              </span>
            </span>
            {fieldId && (
              <span className="font-mono text-[10px] text-muted-foreground/60">{fieldId}</span>
            )}
          </div>
          <Input
            id={String(name)}
            {...field}
            value={field.value ?? ''}
            placeholder={placeholder}
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
