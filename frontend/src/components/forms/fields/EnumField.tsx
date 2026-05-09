import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Label } from '@/components/ui/label'
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
}

export function EnumField<T extends FieldValues>({ name, schema, control }: Props<T>) {
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
          <Select value={field.value ?? ''} onValueChange={field.onChange}>
            <SelectTrigger id={name} className={fieldState.error ? 'border-destructive' : ''}>
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
