import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getReports, deleteReport } from '@/lib/api'
import type { ReportResponse } from '@/types/template'
import { useAuth } from '@/context/AuthContext'
import { FilterSidebar, type ActiveFilters } from '@/components/reports/FilterSidebar'
import { Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveRef(id: string): string {
  return 'rpt_' + id.replace(/-/g, '').slice(0, 7)
}

function toRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  if (hours < 48) return 'yesterday'
  return `${Math.floor(hours / 24)}d ago`
}

function deriveSubject(r: ReportResponse) {
  const d = r.intake_data as Record<string, unknown>
  return {
    name: String(d.supplier_name ?? '—'),
    evaluator: String(d.evaluator_name ?? ''),
    country: String(d.supplier_country ?? ''),
    category: String(d.commodity_category ?? ''),
  }
}

function deriveTplBadge(templateId: string): string {
  if (templateId.toLowerCase().includes('ncr')) return 'NCR'
  if (templateId.toLowerCase().includes('sat')) return 'SAT'
  return 'SQR'
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'draft',
  generating: 'generating',
  review: 'in review',
  approved: 'approved',
  exported: 'exported',
}

const STATUS_CLASS: Record<string, string> = {
  draft: 'border-border text-muted-foreground',
  generating: 'border-amber-200 bg-amber-50 text-amber-700',
  review: 'border-blue-200 bg-blue-50 text-blue-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  exported: 'border-purple-200 bg-purple-50 text-purple-700',
}

const VERDICT_CLASS: Record<string, string> = {
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CONDITIONAL: 'border-amber-200 bg-amber-50 text-amber-700',
  REJECTED: 'border-destructive/30 bg-destructive/10 text-destructive',
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [reports, setReports] = useState<ReportResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ActiveFilters>({ status: '', evaluator: '' })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    getReports()
      .then(setReports)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load reports'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this report? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteReport(id)
      setReports(prev => prev.filter(r => r.id !== id))
    } catch {
      // leave list unchanged on error
    } finally {
      setDeletingId(null)
    }
  }

  function handleEdit(r: ReportResponse) {
    navigate('/reports/new', {
      state: {
        editReport: { id: r.id, intake_data: r.intake_data },
      },
    })
  }

  const filtered = reports.filter(r => {
    const subject = deriveSubject(r)
    const ref = deriveRef(r.id)
    if (filters.status && r.status !== filters.status) return false
    if (filters.evaluator && subject.evaluator !== filters.evaluator) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !subject.name.toLowerCase().includes(q) &&
        !ref.toLowerCase().includes(q) &&
        !subject.evaluator.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <header className="border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/templates')}
              className="flex items-center gap-1.5 text-sm font-semibold tracking-tight"
            >
              <span className="text-primary">◆</span> Provenance
            </button>
            <nav className="flex gap-1">
              <button
                onClick={() => navigate('/templates')}
                className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Templates
              </button>
              <button
                className="border-b-2 border-primary px-3 py-1 text-sm font-medium"
              >
                Reports
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left filter sidebar */}
        <div className="px-6 py-6">
          {!loading && !error && (
            <FilterSidebar
              reports={reports}
              activeFilters={filters}
              onFilterChange={setFilters}
            />
          )}
        </div>

        {/* Main content */}
        <main className="flex-1 px-6 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Reports</h1>
            <button
              onClick={() => navigate('/templates')}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
            >
              + New report
            </button>
          </div>

          {/* Search + sort */}
          <div className="mb-4 flex items-center gap-3">
            <input
              type="text"
              placeholder="search supplier or ref..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">sort: updated ↓</span>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {!loading && !error && filtered.length === 0 && (
            <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
              <p className="font-medium">No reports found.</p>
              {reports.length === 0 ? (
                <p className="mt-1 text-sm">Start from a template to create your first report.</p>
              ) : (
                <p className="mt-1 text-sm">Try adjusting your filters or search query.</p>
              )}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[7rem_1fr_4rem_5rem_7rem_7rem_6rem_5rem] border-b bg-muted/50 px-4 py-2">
                {['ID', 'SUBJECT', 'TPL', 'SCORE', 'VERDICT', 'STATUS', 'UPDATED', 'ACTIONS'].map(h => (
                  <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {filtered.map((r, i) => {
                const subject = deriveSubject(r)
                const ref = deriveRef(r.id)
                const tpl = deriveTplBadge(r.template_id)
                const verdict = r.verdict?.toUpperCase() ?? null

                return (
                  <div
                    key={r.id}
                    className={cn(
                      'grid grid-cols-[7rem_1fr_4rem_5rem_7rem_7rem_6rem_5rem] items-center px-4 py-2.5',
                      i < filtered.length - 1 && 'border-b',
                      'hover:bg-muted/20',
                    )}
                  >
                    {/* ID */}
                    <span className="font-mono text-[11px] text-muted-foreground">{ref}</span>

                    {/* Subject */}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{subject.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {subject.evaluator}
                        {subject.country && ` · ${subject.country}`}
                        {subject.category && ` · ${subject.category}`}
                      </p>
                    </div>

                    {/* TPL */}
                    <span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {tpl}
                      </span>
                    </span>

                    {/* SCORE */}
                    <span className="font-mono text-sm text-muted-foreground">
                      {r.score != null ? r.score.toFixed(1) : '—'}
                    </span>

                    {/* VERDICT */}
                    <span>
                      {verdict ? (
                        <span
                          className={cn(
                            'rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                            VERDICT_CLASS[verdict] ?? 'border-border text-muted-foreground',
                          )}
                        >
                          {verdict}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </span>

                    {/* STATUS */}
                    <span>
                      <span
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                          STATUS_CLASS[r.status] ?? 'border-border text-muted-foreground',
                        )}
                      >
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </span>

                    {/* UPDATED */}
                    <span className="text-xs text-muted-foreground">
                      {toRelativeTime(r.updated_at || r.created_at)}
                    </span>

                    {/* ACTIONS */}
                    <span className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(r)}
                        className="rounded p-1 text-muted-foreground/40 transition-colors hover:bg-primary/10 hover:text-primary"
                        title="Edit report"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        className={cn(
                          'rounded p-1 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive',
                          deletingId === r.id && 'opacity-50',
                        )}
                        title="Delete report"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
