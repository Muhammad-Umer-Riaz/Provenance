import type { ReportResponse } from '@/types/template'
import { cn } from '@/lib/utils'

export interface ActiveFilters {
  status: string
  evaluator: string
}

interface Props {
  reports: ReportResponse[]
  activeFilters: ActiveFilters
  onFilterChange: (filters: ActiveFilters) => void
}

const STATUS_OPTIONS = ['Draft', 'Generating', 'In review', 'Approved', 'Exported']
const STATUS_MAP: Record<string, string> = {
  Draft: 'draft',
  Generating: 'generating',
  'In review': 'review',
  Approved: 'approved',
  Exported: 'exported',
}

function deriveEvaluator(report: ReportResponse): string {
  return String((report.intake_data as Record<string, unknown>)?.evaluator_name ?? '')
}

export function FilterSidebar({ reports, activeFilters, onFilterChange }: Props) {
  const statusCounts = STATUS_OPTIONS.reduce<Record<string, number>>((acc, label) => {
    acc[label] = reports.filter(r => r.status === STATUS_MAP[label]).length
    return acc
  }, {})

  const evaluators = [...new Set(reports.map(deriveEvaluator).filter(Boolean))]
  const evaluatorCounts = evaluators.reduce<Record<string, number>>((acc, ev) => {
    acc[ev] = reports.filter(r => deriveEvaluator(r) === ev).length
    return acc
  }, {})

  function setStatus(label: string) {
    const mapped = STATUS_MAP[label] ?? ''
    onFilterChange({
      ...activeFilters,
      status: activeFilters.status === mapped ? '' : mapped,
    })
  }

  function setEvaluator(ev: string) {
    onFilterChange({
      ...activeFilters,
      evaluator: activeFilters.evaluator === ev ? '' : ev,
    })
  }

  return (
    <aside className="flex w-48 shrink-0 flex-col gap-5 border-r pr-4 pt-1">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Filters
        </p>

        {/* Status */}
        <div className="mb-4">
          <p className="mb-1.5 text-xs text-muted-foreground">Status</p>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => onFilterChange({ ...activeFilters, status: '' })}
                className={cn(
                  'flex w-full items-center justify-between rounded px-2 py-1 text-xs',
                  !activeFilters.status
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <span>All</span>
                <span>{reports.length}</span>
              </button>
            </li>
            {STATUS_OPTIONS.map(label => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => setStatus(label)}
                  className={cn(
                    'flex w-full items-center justify-between rounded px-2 py-1 text-xs',
                    activeFilters.status === STATUS_MAP[label]
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span>{label}</span>
                  <span>{statusCounts[label]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Template — SQR only */}
        <div className="mb-4">
          <p className="mb-1.5 text-xs text-muted-foreground">Template</p>
          <ul className="space-y-1">
            <li>
              <span className="flex items-center justify-between rounded px-2 py-1 text-xs text-muted-foreground">
                <span>SQR</span>
                <span>{reports.length}</span>
              </span>
            </li>
          </ul>
        </div>

        {/* Evaluator */}
        {evaluators.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Evaluator</p>
            <ul className="space-y-1">
              {evaluators.map(ev => (
                <li key={ev}>
                  <button
                    type="button"
                    onClick={() => setEvaluator(ev)}
                    className={cn(
                      'flex w-full items-center justify-between rounded px-2 py-1 text-xs',
                      activeFilters.evaluator === ev
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <span className="truncate">{ev}</span>
                    <span className="ml-1 shrink-0">{evaluatorCounts[ev]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-auto font-mono text-[9px] text-muted-foreground/60">
        schema v1 · RLS-isolated
      </p>
    </aside>
  )
}
