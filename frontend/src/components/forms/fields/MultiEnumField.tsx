import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import type { IntakeFieldSchema } from '@/types/template'

interface Props<T extends FieldValues> {
  name: Path<T>
  schema: IntakeFieldSchema
  control: Control<T>
}

export function MultiEnumField<T extends FieldValues>({ name, schema, control }: Props<T>) {
  return (
    <Controller
      name={name}
      control={control}
      defaultValue={[] as never}
      render={({ field, fieldState }) => {
        const selected: string[] = Array.isArray(field.value) ? field.value : []

        function toggle(value: string) {
          const next = selected.includes(value)
            ? selected.filter(v => v !== value)
            : [...selected, value]
          field.onChange(next)
        }

        return (
          <div className="space-y-2">
            <Label>
              {schema.label}
              {schema.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(schema.values ?? []).map(v => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selected.includes(v)}
                    onCheckedChange={() => toggle(v)}
                  />
                  <span className="text-sm">{v}</span>
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {selected.map(v => (
                  <Badge key={v} variant="secondary">{v}</Badge>
                ))}
              </div>
            )}
            {fieldState.error && (
              <p className="text-xs text-destructive">{fieldState.error.message}</p>
            )}
          </div>
        )
      }}
    />
  )
}
