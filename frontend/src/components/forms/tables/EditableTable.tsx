import { useState, useEffect, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

export interface CellMeta {
  type: 'string' | 'number' | 'integer' | 'date' | 'enum' | 'readonly' | 'computed'
  values?: string[]
  min?: number
  max?: number
  step?: number
}

export type RowData = Record<string, unknown>

interface Props {
  columns: ColumnDef<RowData, unknown>[]
  data: RowData[]
  onChange: (rows: RowData[]) => void
  fixedRows?: boolean
  minRows?: number
  addLabel?: string
  errors?: Record<number, Record<string, string>>
  defaultRow?: (currentData: RowData[]) => RowData
}

export function EditableTable({
  columns,
  data,
  onChange,
  fixedRows = false,
  addLabel = 'Add row',
  errors = {},
  defaultRow,
}: Props) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: { onChange, errors },
  })

  function addRow() {
    if (defaultRow) {
      onChange([...data, defaultRow(data)])
      return
    }
    const blank: RowData = {}
    for (const col of columns) {
      const id = col.id ?? (col as { accessorKey?: string }).accessorKey ?? ''
      blank[id] = ''
    }
    onChange([...data, blank])
  }

  function removeRow(index: number) {
    onChange(data.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                {!fixedRows && <th className="w-8" />}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, rowIndex) => (
              <tr key={row.id} className="border-t">
                {row.getVisibleCells().map(cell => {
                  const cellDef = cell.column.columnDef.cell
                  return (
                    <td key={cell.id} className="px-3 py-1.5">
                      {typeof cellDef === 'function'
                        ? cellDef(cell.getContext())
                        : flexRender(cellDef, cell.getContext())}
                    </td>
                  )
                })}
                {!fixedRows && (
                  <td className="px-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(rowIndex)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (fixedRows ? 0 : 1)}
                  className="px-3 py-4 text-center text-muted-foreground"
                >
                  No rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!fixedRows && (
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {addLabel}
        </Button>
      )}
    </div>
  )
}

// ── Cell renderers ─────────────────────────────────────────────────────────────

interface CellProps {
  value: unknown
  onChange: (v: unknown) => void
  meta: CellMeta
  error?: string
}

export function EditableCell({ value, onChange, meta, error }: CellProps) {
  const isFocused = useRef(false)
  const [localValue, setLocalValue] = useState(String(value ?? ''))
  const base = error ? 'border-destructive' : ''

  // Sync external value changes only while the field is not focused
  // (handles computed cells and external resets without fighting user input)
  useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(String(value ?? ''))
    }
  }, [value])

  if (meta.type === 'readonly' || meta.type === 'computed') {
    return <span className="text-sm text-muted-foreground">{String(value ?? '')}</span>
  }

  if (meta.type === 'enum') {
    return (
      <Select value={String(value ?? '')} onValueChange={onChange}>
        <SelectTrigger className={`h-8 text-sm ${base}`}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {(meta.values ?? []).map(v => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  const isNumeric = meta.type === 'number' || meta.type === 'integer'

  function commitNumeric(raw: string) {
    if (raw === '') { onChange(''); return }
    const num = Number(raw)
    if (!isNaN(num)) onChange(meta.type === 'integer' ? Math.round(num) : num)
  }

  function sanitize(raw: string): string {
    if (meta.type === 'integer') return raw.replace(/[^0-9]/g, '')
    if (meta.type === 'number') return raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    return raw
  }

  return (
    <Input
      type="text"
      inputMode={meta.type === 'integer' ? 'numeric' : meta.type === 'number' ? 'decimal' : undefined}
      placeholder={meta.type === 'date' ? 'YYYY-MM-DD' : undefined}
      value={localValue}
      onFocus={() => { isFocused.current = true }}
      onBlur={() => {
        isFocused.current = false
        if (isNumeric) commitNumeric(localValue)
      }}
      onChange={e => {
        const raw = sanitize(e.target.value)
        setLocalValue(raw)
        if (isNumeric) {
          if (raw === '' || !isNaN(Number(raw))) commitNumeric(raw)
        } else {
          onChange(raw)
        }
      }}
      className={`h-8 text-sm ${base}`}
    />
  )
}
