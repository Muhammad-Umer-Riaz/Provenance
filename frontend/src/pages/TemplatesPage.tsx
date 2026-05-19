import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getTemplates, getReports } from '@/lib/api'
import type { TemplateListItem, ReportResponse } from '@/types/template'
import { StrategyBar } from '@/components/templates/StrategyBar'
import { CommandPalette } from '@/components/templates/CommandPalette'
import { cn } from '@/lib/utils'

// ── Skeleton templates ─────────────────────────────────────────────────────────

const SKELETON_TEMPLATES = [
  {
    id: 'sat.acceptance.v0',
    version: 'v0.2.0',
    name: 'Site Acceptance Test',
    description:
      'Measurement-analytics template for equipment commissioning. Engineer fills structured test-results table; results narrative draws analytical conclusions from per-test pass/fail data. v1 image-annotation pattern: measurement type + headline values + engineer observation → LLM synthesis. v2: image upload + vision model integration.',
    sections: 6,
    fields: 42,
    runs: 4,
  },
  {
    id: 'ncr.nonconformance.v0',
    version: 'v0.2.0',
    name: 'Non-Conformance Report',
    description:
      'Defect-severity classifier gates the escalation-path narrative and corrective action conditions. Hybrid CAR table: engineer-entered action items plus LLM-proposed gaps derived from root cause analysis. SLA calculator fields enforce response and closure deadlines.',
    sections: 4,
    fields: 22,
    runs: 12,
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'GOOD MORNING'
  if (h < 18) return 'GOOD AFTERNOON'
  return 'GOOD EVENING'
}

function firstName(email: string): string {
  return email.split('@')[0].split('.')[0]
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

function deriveStrategyGroups(counts: Record<string, number> = {}) {
  const direct = counts['direct_input'] ?? 0
  const review = (counts['extractor'] ?? 0) + (counts['classifier'] ?? 0)
  const auto =
    (counts['lookup'] ?? 0) +
    (counts['calculator'] ?? 0) +
    (counts['template_fill'] ?? 0) +
    (counts['narrative_llm'] ?? 0) +
    (counts['grounded_llm'] ?? 0) +
    (counts['hybrid'] ?? 0)
  return { direct, review, auto }
}

const STATUS_CLASS: Record<string, string> = {
  draft: 'text-muted-foreground',
  generating: 'text-amber-600',
  review: 'text-blue-600',
  approved: 'text-emerald-600',
  exported: 'text-purple-600',
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TemplatesPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [reports, setReports] = useState<ReportResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    Promise.all([getTemplates(), getReports()])
      .then(([ts, rs]) => { setTemplates(ts); setReports(rs) })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  // ⌘K handler
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sqrTemplate =
    templates.find(t => t.template_id === 'supplier-qualification-report') ?? null

  // "Continue draft" reads from localStorage — no backend phantom drafts.
  // Key is scoped to (user_id, template_id) so drafts don't leak across accounts
  // on a shared browser.
  const localDraftName: string | null = (() => {
    if (!sqrTemplate || !user?.id) return null
    try {
      const raw = localStorage.getItem(`draft:${user.id}:${sqrTemplate.template_id}`)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return String(parsed?.intake_data?.supplier_name ?? '') || null
    } catch {
      return null
    }
  })()

  // Recent non-draft reports (last 3)
  const recentReports = reports
    .filter(r => r.status !== 'draft')
    .slice(0, 3)

  const totalStrategies = sqrTemplate
    ? Object.keys(sqrTemplate.strategy_counts ?? {}).length
    : 7

  const { direct, review, auto } = deriveStrategyGroups(sqrTemplate?.strategy_counts)

  function startReport() {
    if (sqrTemplate) navigate('/reports/new', { state: { template: sqrTemplate } })
  }

  const userFirstName = user?.email ? firstName(user.email).toUpperCase() : ''

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
              <button className="border-b-2 border-primary px-3 py-1 text-sm font-medium">
                Templates
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
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

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {/* Heading */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {greeting()}, {userFirstName}
            </p>
            <h1 className="mt-1 text-3xl font-bold">Start a report</h1>
          </div>
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Jump to
            <kbd className="rounded border bg-background px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && sqrTemplate && (
          <>
            {/* YOUR TEMPLATE — featured card */}
            <div className="mb-8 rounded-xl border bg-card">
              <div className="border-b px-5 py-2">
                <span className="font-mono text-[10px] text-primary">YOUR TEMPLATE</span>
              </div>
              <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_260px]">
                {/* Left: template info */}
                <div className="p-6">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {sqrTemplate.template_id}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      v{sqrTemplate.version}
                    </span>
                    <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
                      PRODUCTION
                    </span>
                  </div>
                  <h2 className="mb-2 text-2xl font-bold">{sqrTemplate.name}</h2>
                  <p className="mb-4 text-sm text-muted-foreground">{sqrTemplate.description}</p>

                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      What you'll do
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {direct} direct + {review} review · {auto} auto
                    </span>
                  </div>
                  <StrategyBar counts={sqrTemplate.strategy_counts ?? {}} />
                </div>

                {/* Right: actions + recent */}
                <div className="flex flex-col gap-4 border-t p-6 lg:border-l lg:border-t-0">
                  <div>
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Start fresh
                    </p>
                    <button
                      onClick={startReport}
                      className="mb-2 w-full rounded-md bg-foreground py-2 text-sm font-medium text-background hover:bg-foreground/90"
                    >
                      Begin new SQR
                    </button>
                    {localDraftName && (
                      <button
                        onClick={startReport}
                        className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
                      >
                        <span>
                          Continue draft ·{' '}
                          <span className="font-medium">{localDraftName}</span>
                        </span>
                        <span className="text-muted-foreground">→</span>
                      </button>
                    )}
                  </div>

                  {recentReports.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Your recent
                        </p>
                        <button
                          onClick={() => navigate('/reports')}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          {reports.filter(r => r.status !== 'draft').length} total →
                        </button>
                      </div>
                      <ul className="space-y-2">
                        {recentReports.map(r => {
                          const name = String(r.intake_data.supplier_name ?? 'Unknown')
                          return (
                            <li key={r.id} className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className={cn(
                                    'h-1.5 w-1.5 shrink-0 rounded-full',
                                    r.status === 'approved' ? 'bg-emerald-500' :
                                    r.status === 'review' ? 'bg-blue-500' :
                                    'bg-amber-500',
                                  )}
                                />
                                <span className="truncate text-xs">{name}</span>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className={cn('text-[10px]', STATUS_CLASS[r.status] ?? 'text-muted-foreground')}>
                                  {r.status}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {toRelativeTime(r.updated_at || r.created_at)}
                                </span>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* OTHER TEMPLATES */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Other templates
              </span>
              <span className="text-xs text-muted-foreground">
                {SKELETON_TEMPLATES.length} available
              </span>
            </div>

            <div className="space-y-2">
              {SKELETON_TEMPLATES.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{t.id}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{t.version}</span>
                      <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-700">
                        SKELETON
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-muted-foreground">
                      {t.sections} sections · {t.fields} fields · {t.runs} runs
                    </p>
                  </div>
                  <button
                    disabled
                    className="shrink-0 rounded-md border px-4 py-1.5 text-sm text-muted-foreground opacity-50 cursor-not-allowed"
                  >
                    Begin →
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-10 flex items-center justify-between border-t pt-4">
          <span className="font-mono text-[10px] text-muted-foreground/60">
            schema v1 · {totalStrategies} strategies registered · all reports RLS-isolated
          </span>
          <button className="text-[11px] text-muted-foreground hover:text-foreground">
            request a new template →
          </button>
        </div>
      </main>
    </div>
  )
}
