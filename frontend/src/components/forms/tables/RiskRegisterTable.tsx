import { useFieldArray, useWatch, Controller, type Control } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

export const RISK_CATEGORIES = [
  'Single-source dependency',
  'Financial instability',
  'Geopolitical / country risk',
  'Quality capability gap',
  'Capacity constraint',
  'Lead time variability',
  'IP / data security',
  'Regulatory / compliance',
  'Currency / FX exposure',
  'Force majeure',
  'Other',
]

interface CardProps {
  index: number
  control: Control<IntakeFormValues>
  onRemove: () => void
}

function RiskCard({ index, control, onRemove }: CardProps) {
  const riskRegister = useWatch({ control, name: 'risk_register' })
  const row = riskRegister?.[index]
  const l = Number(row?.likelihood ?? 0)
  const imp = Number(row?.impact ?? 0)
  const priority = l > 0 && imp > 0 ? l * imp : null

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Risk {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Category *</Label>
          <Controller
            name={`risk_register.${index}.risk_category` as const}
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {RISK_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Description *</Label>
          <Controller
            name={`risk_register.${index}.risk_item` as const}
            control={control}
            render={({ field }) => (
              <Input {...field} placeholder="Describe the specific risk…" />
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Likelihood (1–5) *</Label>
          <Controller
            name={`risk_register.${index}.likelihood` as const}
            control={control}
            render={({ field }) => (
              <Input
                type="text"
                inputMode="numeric"
                value={field.value === '' ? '' : String(field.value)}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '')
                  field.onChange(v === '' ? '' : Number(v))
                }}
              />
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Impact (1–5) *</Label>
          <Controller
            name={`risk_register.${index}.impact` as const}
            control={control}
            render={({ field }) => (
              <Input
                type="text"
                inputMode="numeric"
                value={field.value === '' ? '' : String(field.value)}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '')
                  field.onChange(v === '' ? '' : Number(v))
                }}
              />
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Priority</Label>
          <div className="flex h-9 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-semibold">
            {priority ?? '—'}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Owner *</Label>
          <Controller
            name={`risk_register.${index}.owner` as const}
            control={control}
            render={({ field }) => <Input {...field} />}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Mitigation</Label>
        <Controller
          name={`risk_register.${index}.mitigation` as const}
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value ?? ''}
              placeholder="Describe the mitigation strategy…"
            />
          )}
        />
      </div>
    </div>
  )
}

interface Props {
  control: Control<IntakeFormValues>
}

export function RiskRegisterTable({ control }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: 'risk_register' })

  return (
    <div className="space-y-3">
      <div>
        <Label>
          Risk register <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add at least one risk. Priority = Likelihood × Impact.
        </p>
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
          No risks added yet.
        </p>
      )}

      {fields.map((field, index) => (
        <RiskCard
          key={field.id}
          index={index}
          control={control}
          onRemove={() => remove(index)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({
            risk_category: '',
            risk_item: '',
            likelihood: '',
            impact: '',
            owner: '',
            mitigation: '',
          })
        }
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add risk
      </Button>
    </div>
  )
}
