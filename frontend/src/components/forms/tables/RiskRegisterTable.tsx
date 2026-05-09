import { useFieldArray, useWatch, Controller, type Control } from 'react-hook-form'
import type { IntakeFormValues } from '../IntakeWizard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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

function priorityLevel(p: number): { label: string; className: string } {
  if (p >= 15) return { label: 'HIGH', className: 'bg-destructive/10 text-destructive border-destructive/20' }
  if (p >= 6) return { label: 'MEDIUM', className: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: 'LOW', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

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
  const level = priority != null ? priorityLevel(priority) : null

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          RISK_REGISTER[{index}]
        </span>
        <div className="flex items-center gap-2">
          {level && priority != null && (
            <span
              className={cn(
                'rounded border px-2 py-0.5 font-mono text-[10px] font-semibold',
                level.className,
              )}
            >
              {level.label} · PRIORITY {priority}
            </span>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium">
                Category <span className="font-mono text-[10px] text-muted-foreground">req</span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/60">risk_category</span>
            </div>
            <Controller
              name={`risk_register.${index}.risk_category` as const}
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger className="h-8 text-xs">
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
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium">
                Description <span className="font-mono text-[10px] text-muted-foreground">req</span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/60">risk_item</span>
            </div>
            <Controller
              name={`risk_register.${index}.risk_item` as const}
              control={control}
              render={({ field }) => (
                <Input {...field} className="h-8 text-xs" placeholder="Describe the specific risk…" />
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <span className="text-xs font-medium">
              Likelihood <span className="font-mono text-[10px] text-muted-foreground">req</span>
            </span>
            <Controller
              name={`risk_register.${index}.likelihood` as const}
              control={control}
              render={({ field }) => (
                <Input
                  type="text"
                  inputMode="numeric"
                  className="h-8 text-xs"
                  placeholder="1–5"
                  value={field.value === '' ? '' : String(field.value)}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9]/g, '')
                    field.onChange(v === '' ? '' : Math.min(5, Number(v)))
                  }}
                />
              )}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium">
              Impact <span className="font-mono text-[10px] text-muted-foreground">req</span>
            </span>
            <Controller
              name={`risk_register.${index}.impact` as const}
              control={control}
              render={({ field }) => (
                <Input
                  type="text"
                  inputMode="numeric"
                  className="h-8 text-xs"
                  placeholder="1–5"
                  value={field.value === '' ? '' : String(field.value)}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9]/g, '')
                    field.onChange(v === '' ? '' : Math.min(5, Number(v)))
                  }}
                />
              )}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium">
              Priority <span className="font-mono text-[10px] text-muted-foreground">not priority</span>
            </span>
            <div className="flex h-8 items-center rounded-md border bg-muted/40 px-2 text-xs text-muted-foreground">
              {priority != null ? (
                <span className="font-medium">{priority}</span>
              ) : (
                <span>= L×I</span>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium">
              Owner <span className="font-mono text-[10px] text-muted-foreground">req</span>
            </span>
            <Controller
              name={`risk_register.${index}.owner` as const}
              control={control}
              render={({ field }) => (
                <Input {...field} className="h-8 text-xs" />
              )}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium">
            Mitigation <span className="font-mono text-[10px] text-muted-foreground">opt</span>
          </span>
          <Controller
            name={`risk_register.${index}.mitigation` as const}
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value ?? ''}
                className="h-8 text-xs"
                placeholder="Describe mitigation strategy…"
              />
            )}
          />
        </div>
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
      {fields.length === 0 && (
        <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
          No risks added yet — add at least one before submitting.
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
        className="w-full"
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
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add risk
      </Button>
    </div>
  )
}
