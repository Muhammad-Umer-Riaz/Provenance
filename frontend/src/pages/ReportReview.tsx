import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReport, getReportFields, updateField, regenerateField } from '@/lib/api'
import { subscribeToReportFields } from '@/lib/realtime'
import type { ReportField, ReportResponse, ValidationWarning } from '@/types/template'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────────

const ACRONYMS = new Set(['car', 'otd', 'ncr', 'sla', 'llm', 'sqr', 'id', 'duns', 'vat'])

function formatId(id: string): string {
  return id
    .split('_')
    .map((w) => ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

type StructuredValue =
  | { type: 'array'; rows: Record<string, unknown>[] }
  | { type: 'dict'; obj: Record<string, unknown> }

function parseStructuredValue(value: string | null): StructuredValue | null {
  if (!value) return null
  const t = value.trim()
  if (!t.startsWith('[') && !t.startsWith('{')) return null
  try {
    const parsed = JSON.parse(t)
    if (Array.isArray(parsed) && (parsed.length === 0 || typeof parsed[0] === 'object'))
      return { type: 'array', rows: parsed as Record<string, unknown>[] }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed))
      return { type: 'dict', obj: parsed as Record<string, unknown> }
    return null
  } catch {
    return null
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ s }: { s: ReportField['status'] }) {
  const cls = {
    pending: 'bg-slate-100 text-slate-400 border border-slate-200',
    generating: 'bg-blue-100 text-blue-600',
    draft: 'bg-slate-100 text-slate-600',
    edited: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-600',
  }[s] ?? 'bg-slate-100 text-slate-600'

  const label = s.charAt(0).toUpperCase() + s.slice(1)
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium', cls)}>
      {s === 'generating' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {label}
    </span>
  )
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-xs text-muted-foreground">—</span>
  const cls =
    verdict === 'Approved' || verdict === 'Preferred'
      ? 'bg-emerald-100 text-emerald-700'
      : verdict === 'Conditional'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-600'
  return (
    <span className={cn('rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', cls)}>
      {verdict}
    </span>
  )
}

function StrategyTag({ strategy }: { strategy: string }) {
  return (
    <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
      {strategy}
    </span>
  )
}

function TableDisplay({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="text-[11px] text-muted-foreground">(empty table)</p>
  const keys = Object.keys(rows[0]).filter((k) => k !== 'id')
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b">
            {keys.map((k) => (
              <th key={k} className="pb-1 pr-3 text-left font-medium text-muted-foreground">
                {formatId(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {keys.map((k) => (
                <td key={k} className="py-1 pr-3 text-foreground">
                  {Array.isArray(row[k]) ? (row[k] as string[]).join(', ') : String(row[k] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DictDisplay({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== '' && v !== undefined)
  if (!entries.length) return <p className="text-[11px] text-muted-foreground">(empty)</p>
  return (
    <div className="space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-2 text-[11px]">
          <span className="shrink-0 text-muted-foreground">{formatId(k)}:</span>
          <span className="text-foreground">
            {Array.isArray(v) ? (v as string[]).join(', ') : String(v)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── FieldRow (center pane row) ─────────────────────────────────────────────────

function FieldRow({
  field,
  isSelected,
  onClick,
}: {
  field: ReportField
  isSelected: boolean
  onClick: () => void
}) {
  const structured = parseStructuredValue(field.value)
  const showDiff =
    field.status === 'edited' &&
    field.original_value != null &&
    field.original_value !== field.value

  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-md border bg-card px-3 py-2.5 transition-all hover:border-foreground/20',
        isSelected && 'border-l-[3px] border-l-foreground/50 bg-accent/5',
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <StatusBadge s={field.status} />
          <span className="text-sm font-medium">{formatId(field.field_id)}</span>
        </div>
        <StrategyTag strategy={field.strategy} />
      </div>

      {/* Value */}
      {field.value && (
        <div className="mt-1.5">
          {structured?.type === 'array' ? (
            <TableDisplay rows={structured.rows} />
          ) : structured?.type === 'dict' ? (
            <DictDisplay obj={structured.obj} />
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{field.value}</p>
          )}
        </div>
      )}

      {/* Diff: show original struck through when edited */}
      {showDiff && (
        <div className="mt-2 rounded border border-amber-200 bg-amber-50/60 px-2 py-1.5">
          <p className="mb-0.5 text-[9px] font-medium uppercase tracking-widest text-amber-600">
            Original
          </p>
          <p className="text-[11px] text-red-500 line-through">{field.original_value}</p>
        </div>
      )}

      {!field.value && field.status === 'failed' && (
        <p className="mt-1 text-[11px] text-red-500">Generation failed — click to regenerate</p>
      )}
    </div>
  )
}

// ── FieldPanel (right pane) ────────────────────────────────────────────────────

function FieldPanel({
  field,
  editingId,
  editDraft,
  saving,
  onStartEdit,
  onCancelEdit,
  onEditChange,
  onSaveEdit,
  onApprove,
  onRegenerate,
}: {
  field: ReportField
  editingId: string | null
  editDraft: string
  saving: boolean
  onStartEdit: (f: ReportField) => void
  onCancelEdit: () => void
  onEditChange: (v: string) => void
  onSaveEdit: () => void
  onApprove: (f: ReportField) => void
  onRegenerate: (f: ReportField) => void
}) {
  const isEditing = editingId === field.field_id
  const isTable = parseStructuredValue(field.value) !== null
  const isLocked = ['failed', 'pending', 'generating'].includes(field.status)
  const canApprove = !isLocked
  const canEdit = !isLocked && !isTable
  const canRegenerate = field.status !== 'pending'
  const modelLabel =
    field.strategy === 'narrative_llm'
      ? 'claude-haiku-4-5'
      : field.strategy === 'classifier'
        ? 'gpt-4o-mini (rule-based)'
        : null

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div>
        <p className="text-sm font-semibold">{formatId(field.field_id)}</p>
        <p className="font-mono text-[10px] text-muted-foreground">{field.field_id}</p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge s={field.status} />
        <StrategyTag strategy={field.strategy} />
        {modelLabel && (
          <span className="font-mono text-[9px] text-muted-foreground">{modelLabel}</span>
        )}
      </div>

      <div className="border-t" />

      {isEditing ? (
        /* Edit mode */
        <div className="space-y-2">
          <textarea
            className="w-full rounded border bg-background px-2 py-1.5 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-foreground/30"
            rows={7}
            value={editDraft}
            onChange={(e) => onEditChange(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={onSaveEdit}
              disabled={saving}
              className="flex-1 rounded bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={onCancelEdit}
              className="flex-1 rounded border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* View mode: action buttons */
        <div className="space-y-2">
          {canApprove && (
            <button
              onClick={() => onApprove(field)}
              className={cn(
                'w-full rounded px-3 py-1.5 text-xs font-medium transition-colors',
                field.status === 'approved'
                  ? 'border border-slate-300 hover:bg-muted'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700',
              )}
            >
              {field.status === 'approved' ? 'Unapprove' : 'Approve'}
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => onStartEdit(field)}
              className="w-full rounded border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Edit
            </button>
          )}

          {isTable && !isLocked && (
            <p className="text-[10px] text-muted-foreground">
              Table fields cannot be edited inline — regenerate if intake data has changed.
            </p>
          )}

          {canRegenerate && (
            <button
              onClick={() => onRegenerate(field)}
              disabled={field.status === 'generating'}
              className="w-full rounded border border-dashed px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
            >
              {field.status === 'generating' ? 'Regenerating…' : 'Regenerate'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ReportReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [report, setReport] = useState<ReportResponse | null>(null)
  const [fields, setFields] = useState<ReportField[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedField = fields.find((f) => f.field_id === selectedId) ?? null
  const nonFailedFields = fields.filter(
    (f) => f.status !== 'failed' && f.status !== 'pending',
  )
  const approvedCount = fields.filter((f) => f.status === 'approved').length
  const canExport = nonFailedFields.length > 0 && approvedCount === nonFailedFields.length

  // Group fields by section in DB order
  const sectionOrder: string[] = []
  const fieldsBySection: Record<string, ReportField[]> = {}
  for (const f of fields) {
    if (!fieldsBySection[f.section_id]) {
      fieldsBySection[f.section_id] = []
      sectionOrder.push(f.section_id)
    }
    fieldsBySection[f.section_id].push(f)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function upsertField(updated: ReportField) {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.field_id === updated.field_id)
      if (idx === -1) return [...prev, updated]
      const next = [...prev]
      next[idx] = updated
      return next
    })
  }

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    let channel: ReturnType<typeof subscribeToReportFields> | null = null

    async function load() {
      try {
        const [loadedReport, loadedFields] = await Promise.all([
          getReport(id!),
          getReportFields(id!),
        ])
        setReport(loadedReport)
        setFields(loadedFields)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load report')
      }
    }

    load()
    channel = subscribeToReportFields(id, (updated) => upsertField(updated))
    return () => { channel?.unsubscribe() }
  }, [id])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleApprove(field: ReportField) {
    const newStatus = field.status === 'approved' ? 'draft' : 'approved'
    try {
      const res = await updateField(id!, field.field_id, { status: newStatus })
      upsertField(res)
    } catch (e) {
      console.error('Approve failed', e)
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return
    setSaving(true)
    try {
      const res = await updateField(id!, editingId, { value: editDraft })
      upsertField(res)
      setEditingId(null)
    } catch (e) {
      console.error('Save edit failed', e)
    } finally {
      setSaving(false)
    }
  }

  async function handleRegenerate(field: ReportField) {
    try {
      await regenerateField(id!, field.field_id)
      upsertField({ ...field, status: 'generating' })
    } catch (e) {
      console.error('Regenerate failed', e)
    }
  }

  // ── Error state ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-medium">Failed to load report</p>
          <p className="mt-1 text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  const intake = report?.intake_data ?? {}

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── Sticky header ── */}
      <header className="flex-none border-b bg-background px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="font-mono text-xs text-muted-foreground">
              reports › {id?.slice(0, 8)} › review
            </p>
            {report?.score != null && (
              <span className="font-mono text-xs text-muted-foreground">
                {report.score.toFixed(2)} / 5.00
              </span>
            )}
            {report?.verdict && <VerdictBadge verdict={report.verdict} />}
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">
              {approvedCount}&thinsp;/&thinsp;{nonFailedFields.length} approved
            </span>
            <button
              disabled={!canExport}
              onClick={() => navigate(`/reports/${id}/export`)}
              title={!canExport ? `${nonFailedFields.length - approvedCount} field(s) need approval` : 'Export report'}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                canExport
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'cursor-not-allowed bg-muted text-muted-foreground',
              )}
            >
              Export →
            </button>
          </div>
        </div>
      </header>

      {/* ── Three-pane body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane — intake summary */}
        <aside className="flex w-72 flex-none flex-col overflow-y-auto border-r bg-muted/20 px-4 py-4">
          {/* Score + verdict card */}
          <div className="mb-4 rounded-lg border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Score</span>
              <span className="font-mono text-sm font-semibold">
                {report?.score != null ? report.score.toFixed(2) : '—'}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Verdict</span>
              <VerdictBadge verdict={report?.verdict ?? null} />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="font-mono text-xs">
                {approvedCount} / {nonFailedFields.length}
              </span>
            </div>
          </div>

          {/* Validation warnings */}
          {(report?.validation_warnings ?? []).length > 0 && (
            <div className="mb-4">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-600">
                {report!.validation_warnings!.length} Warning
                {report!.validation_warnings!.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-1.5">
                {(report!.validation_warnings as ValidationWarning[]).map((w) => (
                  <div
                    key={w.id}
                    className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5"
                  >
                    <p className="text-[11px] font-medium text-amber-700">{w.description}</p>
                    {w.message && (
                      <p className="mt-0.5 text-[10px] text-amber-600">{w.message}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Intake summary */}
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Intake
          </p>
          <div className="space-y-2">
            {(
              [
                'supplier_name',
                'supplier_country',
                'commodity_category',
                'review_period',
                'evaluator_name',
              ] as string[]
            ).map((key) => {
              const val = intake[key]
              if (val == null) return null
              return (
                <div key={key} className="flex items-start justify-between gap-2">
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatId(key)}
                  </span>
                  <span className="text-right text-[11px] font-medium text-foreground">
                    {String(val)}
                  </span>
                </div>
              )
            })}

            {Array.isArray(intake.certifications_held) &&
              (intake.certifications_held as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {(intake.certifications_held as string[]).map((c) => (
                    <span
                      key={c}
                      className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-600"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
          </div>
        </aside>

        {/* Center pane — draft report */}
        <main className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto max-w-2xl space-y-8">
            {sectionOrder.map((sectionId) => (
              <section key={sectionId}>
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  § {formatId(sectionId)}
                </h2>
                <div className="space-y-2">
                  {fieldsBySection[sectionId]?.map((field) => (
                    <FieldRow
                      key={field.field_id}
                      field={field}
                      isSelected={selectedId === field.field_id}
                      onClick={() =>
                        setSelectedId(
                          selectedId === field.field_id ? null : field.field_id,
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            ))}

            {fields.length === 0 && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </main>

        {/* Right pane — field metadata + actions */}
        <aside className="flex w-80 flex-none flex-col overflow-y-auto border-l bg-muted/10 px-4 py-4">
          {!selectedField ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-center text-xs text-muted-foreground">
                Click a field to inspect it
              </p>
            </div>
          ) : (
            <FieldPanel
              field={selectedField}
              editingId={editingId}
              editDraft={editDraft}
              saving={saving}
              onStartEdit={(f) => {
                setEditingId(f.field_id)
                setEditDraft(f.value ?? '')
              }}
              onCancelEdit={() => setEditingId(null)}
              onEditChange={setEditDraft}
              onSaveEdit={handleSaveEdit}
              onApprove={handleApprove}
              onRegenerate={handleRegenerate}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
