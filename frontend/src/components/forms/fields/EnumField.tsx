import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { IntakeFieldSchema } from '@/types/template'

interface Props<T extends FieldValues> {
  name: Path<T>
  schema: IntakeFieldSchema
  control: Control<T>
  fieldId?: string
}

export function EnumField<T extends FieldValues>({ name, schema, control, fieldId }: Props<T>) {
  return (
    <Controller
      name={name}
      control={control}
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
          <Select value={field.value ?? ''} onValueChange={field.onChange}>
            <SelectTrigger id={String(name)} className={fieldState.error ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {(schema.values ?? []).map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldState.error && (
            <p className="text-xs text-destructive">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  )
}
