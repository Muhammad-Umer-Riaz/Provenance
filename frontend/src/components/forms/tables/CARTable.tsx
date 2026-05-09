import { useFieldArray, type Control } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { EditableTable, EditableCell, type RowData } from './EditableTable'
import type { IntakeFormValues } from '../IntakeWizard'
import { Label } from '@/components/ui/label'

const STATUS_VALUES = ['Open', 'In progress', 'Closed', 'Overdue']

interface Props {
  control: Control<IntakeFormValues>
  errors?: Record<number, Record<string, string>>
}

export function CARTable({ control, errors = {} }: Props) {
  const { fields, replace } = useFieldArray({ control, name: 'corrective_actions' })

  const data: RowData[] = fields.map(f => ({ ...f }))

  function handleChange(rows: RowData[]) {
    replace(rows as unknown as IntakeFormValues['corrective_actions'])
  }

  function updateCell(rowIndex: number, colName: string, value: unknown) {
    const updated = [...data]
    updated[rowIndex] = { ...updated[rowIndex], [colName]: value }
    handleChange(updated)
  }

  const columns: ColumnDef<RowData, unknown>[] = [
    {
      accessorKey: 'car_id',
      header: 'CAR #',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.car_id}
          onChange={v => updateCell(row.index, 'car_id', v)}
          meta={{ type: 'string' }}
          error={errors[row.index]?.car_id}
        />
      ),
    },
    {
      accessorKey: 'action_item',
      header: 'Action item',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.action_item}
          onChange={v => updateCell(row.index, 'action_item', v)}
          meta={{ type: 'string' }}
          error={errors[row.index]?.action_item}
        />
      ),
    },
    {
      accessorKey: 'owner',
      header: 'Owner',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.owner}
          onChange={v => updateCell(row.index, 'owner', v)}
          meta={{ type: 'string' }}
          error={errors[row.index]?.owner}
        />
      ),
    },
    {
      accessorKey: 'due_date',
      header: 'Due date',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.due_date}
          onChange={v => updateCell(row.index, 'due_date', v)}
          meta={{ type: 'date' }}
          error={errors[row.index]?.due_date}
        />
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.status}
          onChange={v => updateCell(row.index, 'status', v)}
          meta={{ type: 'enum', values: STATUS_VALUES }}
          error={errors[row.index]?.status}
        />
      ),
    },
  ]

  return (
    <div className="space-y-2">
      <Label>Corrective action requests (CARs)</Label>
      <p className="text-xs text-muted-foreground">Optional — add only if CARs were issued.</p>
      <EditableTable
        columns={columns}
        data={data}
        onChange={handleChange}
        addLabel="Add CAR"
        defaultRow={rows => ({
          car_id: `CAR-${String(rows.length + 1).padStart(3, '0')}`,
          action_item: '',
          owner: '',
          due_date: '',
          status: '',
        })}
      />
    </div>
  )
}
