import { useFieldArray, type Control } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { EditableTable, EditableCell, type RowData } from './EditableTable'
import type { IntakeFormValues } from '../IntakeWizard'
import { Label } from '@/components/ui/label'

interface Props {
  control: Control<IntakeFormValues>
  errors?: Record<number, Record<string, string>>
}

export function AuditScorecardTable({ control, errors = {} }: Props) {
  const { fields, replace } = useFieldArray({ control, name: 'audit_scores' })

  const data: RowData[] = fields.map(f => ({ ...f }))

  function handleChange(rows: RowData[]) {
    replace(rows as unknown as IntakeFormValues['audit_scores'])
  }

  function updateCell(rowIndex: number, colName: string, value: unknown) {
    const updated = [...data]
    updated[rowIndex] = { ...updated[rowIndex], [colName]: value }
    handleChange(updated)
  }

  const columns: ColumnDef<RowData, unknown>[] = [
    {
      accessorKey: 'criterion',
      header: 'Criterion',
      cell: ({ row }) => (
        <span className="text-sm">{String(row.original.criterion ?? '')}</span>
      ),
    },
    {
      accessorKey: 'weight',
      header: 'Weight',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.weight}
          onChange={v => updateCell(row.index, 'weight', v)}
          meta={{ type: 'number', min: 0, max: 1 }}
          error={errors[row.index]?.weight}
        />
      ),
    },
    {
      accessorKey: 'score',
      header: 'Score (1–5)',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.score}
          onChange={v => updateCell(row.index, 'score', v)}
          meta={{ type: 'integer', min: 1, max: 5 }}
          error={errors[row.index]?.score}
        />
      ),
    },
    {
      accessorKey: 'notes',
      header: 'Notes',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.notes}
          onChange={v => updateCell(row.index, 'notes', v)}
          meta={{ type: 'string' }}
          error={errors[row.index]?.notes}
        />
      ),
    },
  ]

  return (
    <div className="space-y-2">
      <Label>
        Audit scorecard
        <span className="text-destructive ml-1">*</span>
      </Label>
      <p className="text-xs text-muted-foreground">
        Adjust weights if needed (must sum to 1.0), then score each criterion 1–5.
      </p>
      <EditableTable
        columns={columns}
        data={data}
        onChange={handleChange}
        fixedRows
      />
    </div>
  )
}
