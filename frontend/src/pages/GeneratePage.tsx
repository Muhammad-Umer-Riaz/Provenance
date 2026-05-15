import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { generateReport, getReport, getReportFields } from '@/lib/api'
import { subscribeToReport, subscribeToReportFields } from '@/lib/realtime'
import type { ReportField, ReportResponse } from '@/types/template'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSectionId(id: string): string {
  return id
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function supplierName(report: ReportResponse): string {
  const d = report.intake_data as Record<string, unknown>
  return String(d.supplier_name ?? 'Report')
}

type FieldStatus = ReportField['status']

function StepItem({ label, state }: { label: string; state: 'done' | 'active' | 'upcoming' }) {
  return (
    <span className={cn('flex items-center gap-1', state === 'active' ? 'font-medium text-foreground' : 'text-muted-foreground')}>
      {state === 'done' && <span className="text-emerald-600 text-[10px]">✓</span>}
      {label}
    </span>
  )
}

function StatusIcon({ s }: { s: FieldStatus }) {
  if (s === 'generating') return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
  if (s === 'draft' || s === 'edited' || s === 'approved')
    return <span className="font-mono text-[10px] text-emerald-600">✓</span>
  if (s === 'failed') return <span className="font-mono text-[10px] text-red-500">✗</span>
  return <span className="inline-block h-2.5 w-2.5 rounded-full border border-muted-foreground/40" />
}

const DONE_STATUSES: FieldStatus[] = ['draft', 'edited', 'approved', 'failed']

// ── Component ──────────────────────────────────────────────────────────────────

export function GeneratePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [report, setReport] = useState<ReportResponse | null>(null)
  const [fieldMap, setFieldMap] = useState<Record<string, ReportField>>({})
  const [sectionOrder, setSectionOrder] = useState<string[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const completedRef = useRef(false)

  // Computed
  const allFields = Object.values(fieldMap)
  const total = allFields.length
  const completed = allFields.filter((f) => DONE_STATUSES.includes(f.status)).length
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  // ── Redirect effect — watches state, never called inside a setter ──────────
  useEffect(() => {
    if (completedRef.current) return
    const vals = Object.values(fieldMap)
    const allDone = vals.length > 0 && vals.every((f) => DONE_STATUSES.includes(f.status))
    if (allDone) {
      completedRef.current = true
      navigate(`/reports/${id}/review`)
    }
  }, [fieldMap, id, navigate])

  useEffect(() => {
    if (completedRef.current) return
    if (report?.status === 'review' || report?.status === 'approved') {
      completedRef.current = true
      navigate(`/reports/${id}/review`)
    }
  }, [report?.status, id, navigate])

  // ── Initialisation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return

    let fieldChannel: ReturnType<typeof subscribeToReportFields> | null = null
    let reportChannel: ReturnType<typeof subscribeToReport> | null = null

    async function init() {
      try {
        const [loadedReport, loadedFields] = await Promise.all([
          getReport(id!),
          getReportFields(id!),
        ])

        // Already done — redirect immediately (effects will fire on state update)
        if (loadedReport.status === 'review' || loadedReport.status === 'approved') {
          setReport(loadedReport)
          return
        }

        setReport(loadedReport)

        const map: Record<string, ReportField> = {}
        const sections: string[] = []
        for (const f of loadedFields) {
          map[f.field_id] = f
          if (!sections.includes(f.section_id)) sections.push(f.section_id)
        }
        setFieldMap(map)
        setSectionOrder(sections)

        // Kick off generation — idempotent (backend skips if fields already exist)
        await generateReport(id!)

        // Subscribe BEFORE re-fetching so we don't miss events in between
        fieldChannel = subscribeToReportFields(id!, (updated) => {
          setFieldMap((prev) => ({ ...prev, [updated.field_id]: updated }))
          setSectionOrder((prev) =>
            prev.includes(updated.section_id) ? prev : [...prev, updated.section_id],
          )
        })

        reportChannel = subscribeToReport(id!, (update) => {
          if (update.status) {
            setReport((prev) => (prev ? { ...prev, ...update } : prev))
          }
        })

        // Re-fetch after subscribing — catches events that fired before subscription was ready
        const [freshReport, freshFields] = await Promise.all([
          getReport(id!),
          getReportFields(id!),
        ])

        setReport(freshReport)

        const freshMap: Record<string, ReportField> = {}
        const freshSections: string[] = []
        for (const f of freshFields) {
          freshMap[f.field_id] = f
          if (!freshSections.includes(f.section_id)) freshSections.push(f.section_id)
        }
        setFieldMap(freshMap)
        setSectionOrder(freshSections)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start generation')
      }
    }

    init()

    return () => {
      fieldChannel?.unsubscribe()
      reportChannel?.unsubscribe()
    }
  }, [id])

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-medium">Generation failed to start</p>
          <p className="mt-1 text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      {/* Step ribbon */}
      <div className="flex-none border-b bg-muted/30 px-6 py-2">
        <div className="flex items-center gap-2 text-xs">
          <StepItem label="Intake" state="done" />
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
          <StepItem label="Generate" state="active" />
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
          <StepItem label="Review" state="upcoming" />
        </div>
      </div>

    <div className="mx-auto max-w-2xl w-full px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <p className="font-mono text-xs text-muted-foreground">reports › generate</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {report ? `Generating — ${supplierName(report)}` : 'Starting generation…'}
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {completed}/{total}
          </span>
        </div>
      </div>

      {/* Section cards */}
      <div className="space-y-2">
        {sectionOrder.map((sectionId) => {
          const fields = allFields.filter((f) => f.section_id === sectionId)
          const sectionDone = fields.filter((f) => DONE_STATUSES.includes(f.status)).length
          const sectionComplete = fields.length > 0 && fields.every((f) => DONE_STATUSES.includes(f.status))
          const isExpanded = expanded[sectionId] ?? false

          return (
            <div key={sectionId} className="rounded-lg border bg-card">
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() => setExpanded((prev) => ({ ...prev, [sectionId]: !isExpanded }))}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{formatSectionId(sectionId)}</span>
                </div>
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    sectionComplete ? 'text-emerald-600' : 'text-muted-foreground',
                  )}
                >
                  {sectionDone}/{fields.length}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t px-4 py-2">
                  {fields.map((f) => (
                    <div key={f.field_id} className="flex items-center justify-between py-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{f.field_id}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">{f.strategy}</span>
                        <StatusIcon s={f.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {total === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Generation typically takes 30–60 seconds. You will be redirected automatically.
      </p>
    </div>
    </div>
  )
}
