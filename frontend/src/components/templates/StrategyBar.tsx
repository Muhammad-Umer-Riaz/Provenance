interface Props {
  counts: Record<string, number>
}

// Three user-facing buckets — maps strategy → bucket key
const BUCKET_MAP: Record<string, 'fill' | 'auto' | 'ai'> = {
  direct_input:  'fill',
  extractor:     'fill',
  lookup:        'auto',
  calculator:    'auto',
  template_fill: 'auto',
  classifier:    'auto',
  narrative_llm: 'ai',
  grounded_llm:  'ai',
  hybrid:        'ai',
}

const BUCKET_META = {
  fill: { label: 'You fill in',      color: 'bg-violet-500', dot: 'bg-violet-500' },
  auto: { label: 'Auto-generated',   color: 'bg-blue-500',   dot: 'bg-blue-500'   },
  ai:   { label: 'AI writes',        color: 'bg-amber-500',  dot: 'bg-amber-500'  },
}

export function StrategyBar({ counts }: Props) {
  const buckets = { fill: 0, auto: 0, ai: 0 }

  for (const [strategy, count] of Object.entries(counts)) {
    const bucket = BUCKET_MAP[strategy]
    if (bucket) buckets[bucket] += count
  }

  const total = buckets.fill + buckets.auto + buckets.ai
  if (total === 0) return null

  return (
    <div className="space-y-2">
      {/* Proportional color bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {(Object.keys(buckets) as Array<keyof typeof buckets>).map(key =>
          buckets[key] > 0 ? (
            <div
              key={key}
              className={BUCKET_META[key].color}
              style={{ width: `${(buckets[key] / total) * 100}%` }}
            />
          ) : null
        )}
      </div>

      {/* Plain-English legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {(Object.keys(buckets) as Array<keyof typeof buckets>).map(key =>
          buckets[key] > 0 ? (
            <span key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={`h-2 w-2 rounded-sm ${BUCKET_META[key].dot}`} />
              {BUCKET_META[key].label}
              <span className="font-medium text-foreground">{buckets[key]}</span>
            </span>
          ) : null
        )}
      </div>
    </div>
  )
}
