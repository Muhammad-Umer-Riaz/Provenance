import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TemplateListItem } from '@/types/template'
import { createReport, patchReport } from '@/lib/api'
import { buildStepSchema } from '@/lib/buildIntakeSchema'
import { IntakeSidebar, type StepProgressCount } from './IntakeSidebar'
import { AutosaveIndicator } from './AutosaveIndicator'
import { Step1HeaderInfo } from './steps/Step1HeaderInfo'
import { Step2QualificationContext } from './steps/Step2QualificationContext'
import { Step3PerformanceMetrics } from './steps/Step3PerformanceMetrics'
import { Step4AuditScorecard } from './steps/Step4AuditScorecard'
import { Step5RiskAndCARs } from './steps/Step5RiskAndCARs'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuditScoreRow {
  criterion: string
  weight: number
  score: number | ''
  notes?: string
}

export interface RiskRegisterRow {
  risk_category: string
  risk_item: string
  likelihood: number | ''
  impact: number | ''
  owner: string
  mitigation?: string
}

export interface CARRow {
  car_id?: string
  action_item: string
  owner: string
  due_date?: string
  status?: string
}

export interface IntakeFormValues {
  supplier_name: string
  supplier_country: string
  supplier_contact_name?: string
  supplier_contact_title?: string
  commodity_category: string
  evaluator_name: string
  duns_number?: string
  review_period: string
  qualification_type: string
  previous_verdict?: string
  previous_composite_score?: number
  prev_otd_rate_pct?: number
  prev_defect_rate_pct?: number
  prev_invoice_accuracy_pct?: number
  otd_rate_pct: number
  defect_rate_pct: number
  invoice_accuracy_pct: number
  open_ncr_count: number
  ncr_avg_close_days?: number
  certifications_held: string[]
  otd_pass_target?: number
  defect_pass_target?: number
  invoice_pass_target?: number
  ncr_count_pass_target?: number
  ncr_close_pass_target?: number
  audit_scores: AuditScoreRow[]
  risk_register: RiskRegisterRow[]
  corrective_actions: CARRow[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Header Info', 'Qualification', 'Performance', 'Audit Scorecard', 'Risk & CARs']
const NEXT_LABELS = ['Qualification', 'Performance', 'Audit Scorecard', 'Risk & CARs']

// Required fields per step for progress counting
const STEP_REQUIRED: Array<Array<keyof IntakeFormValues>> = [
  ['supplier_name', 'supplier_country', 'commodity_category', 'evaluator_name', 'review_period'],
  ['qualification_type'],
  ['otd_rate_pct', 'defect_rate_pct', 'invoice_accuracy_pct', 'open_ncr_count', 'certifications_held'],
  ['audit_scores'],
  ['risk_register'],
]

const STEP_FIELD_NAMES: Array<Array<keyof IntakeFormValues>> = STEP_REQUIRED

const DEFAULT_AUDIT_ROWS: AuditScoreRow[] = [
  { criterion: 'Quality management system', weight: 0.25, score: '' },
  { criterion: 'On-time delivery history', weight: 0.25, score: '' },
  { criterion: 'Financial stability', weight: 0.20, score: '' },
  { criterion: 'Technical / engineering capability', weight: 0.15, score: '' },
  { criterion: 'Corrective action responsiveness', weight: 0.10, score: '' },
  { criterion: 'Sustainability & compliance', weight: 0.05, score: '' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeProgressCounts(values: IntakeFormValues): StepProgressCount[] {
  return STEP_REQUIRED.map((fields, i) => {
    if (i === 3) {
      // Audit scorecard: count rows with non-empty score
      const scored = values.audit_scores?.filter(r => r.score !== '' && r.score != null).length ?? 0
      return { filled: scored, total: 6 }
    }
    if (i === 4) {
      // Risk & CARs: at least 1 risk required
      const riskCount = values.risk_register?.length ?? 0
      return { filled: Math.min(riskCount, 1), total: 1 }
    }
    const filled = fields.filter(f => {
      const v = values[f]
      if (v === undefined || v === null || v === '') return false
      if (Array.isArray(v)) return (v as unknown[]).length > 0
      return true
    }).length
    return { filled, total: fields.length }
  })
}

function bottomStatusMessage(step: number, values: IntakeFormValues): string {
  if (step === 3) {
    const scored = values.audit_scores?.filter(r => r.score !== '').length ?? 0
    const totalWeight = values.audit_scores?.reduce((s, r) => s + r.weight, 0) ?? 0
    const sumOk = Math.abs(totalWeight - 1.0) < 0.001
    return `${scored} of 6 scored · ∑ weights = ${totalWeight.toFixed(2)} ${sumOk ? '✓' : '✗'}`
  }
  if (step === 4) {
    const risks = values.risk_register?.length ?? 0
    const cars = values.corrective_actions?.length ?? 0
    if (risks === 0) return 'at least 1 risk required before submitting'
    return `${risks} risk${risks !== 1 ? 's' : ''} · ${cars} CAR${cars !== 1 ? 's' : ''} · ready to submit`
  }
  const counts = computeProgressCounts(values)
  const c = counts[step]
  return `${c.filled} of ${c.total} required filled`
}

// ── Component ──────────────────────────────────────────────────────────────────

// localStorage key scoped to each template — one slot per template per browser
function localKey(templateId: string) {
  return `draft:${templateId}`
}

interface LocalDraft {
  id: string | null
  intake_data: Partial<IntakeFormValues>
}

interface Props {
  template: TemplateListItem
  editReport?: { id: string; intake_data: Record<string, unknown> }
}

export function IntakeWizard({ template, editReport }: Props) {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // In edit mode, draftIdRef is set immediately to the existing report ID
  const draftIdRef = useRef<string | null>(editReport?.id ?? null)
  const savingRef = useRef(false)
  const isEditMode = editReport != null

  const fullSchema = useMemo(
    () => buildStepSchema(template.intake, Object.keys(template.intake)),
    [template.intake],
  )

  // Read localStorage only when NOT editing an existing report
  const savedLocal: LocalDraft | null = isEditMode ? null : (() => {
    try {
      const raw = localStorage.getItem(localKey(template.template_id))
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })()

  // Restore backend draft ID from localStorage if available (new-draft flow only)
  if (!isEditMode && savedLocal?.id && !draftIdRef.current) {
    draftIdRef.current = savedLocal.id
  }

  const defaultValues: Partial<IntakeFormValues> = {
    supplier_name: '',
    supplier_country: '',
    supplier_contact_name: '',
    supplier_contact_title: '',
    commodity_category: '',
    evaluator_name: '',
    review_period: '',
    duns_number: '',
    qualification_type: '',
    certifications_held: [],
    audit_scores: DEFAULT_AUDIT_ROWS,
    risk_register: [],
    corrective_actions: [],
    // Edit mode: use the report's saved data; new-draft mode: use localStorage
    ...(isEditMode
      ? (editReport.intake_data as Partial<IntakeFormValues>)
      : (savedLocal?.intake_data ?? {})),
  }

  const form = useForm<IntakeFormValues>({
    resolver: zodResolver(fullSchema),
    defaultValues,
    mode: 'onTouched',
  })

  const { control, watch, formState: { errors }, trigger, getValues } = form
  const watchValues = watch()
  const supplierName = watch('supplier_name')

  // Persist form values to localStorage on every change — only for new drafts, not edits
  useEffect(() => {
    if (isEditMode) return
    const sub = watch((values) => {
      const entry: LocalDraft = { id: draftIdRef.current, intake_data: values as Partial<IntakeFormValues> }
      localStorage.setItem(localKey(template.template_id), JSON.stringify(entry))
    })
    return () => sub.unsubscribe()
  }, [watch, template.template_id, isEditMode])

  // Backend autosave — only fires if a draft ID exists (i.e. after step 1 Next)
  async function saveDraft() {
    if (!draftIdRef.current || savingRef.current) return
    savingRef.current = true
    setIsSaving(true)
    try {
      await patchReport(draftIdRef.current, { intake_data: getValues() as unknown as Record<string, unknown> })
      setLastSavedAt(new Date())
      // Keep localStorage in sync with the draft ID
      const entry: LocalDraft = { id: draftIdRef.current, intake_data: getValues() }
      localStorage.setItem(localKey(template.template_id), JSON.stringify(entry))
    } catch {
      // Silent — indicator stays at last successful save
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  // Autosave timer — 30s, only meaningful after step 1 completes
  useEffect(() => {
    const id = setInterval(saveDraft, 30_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleNext() {
    const stepFields = STEP_FIELD_NAMES[currentStep]
    const valid = await trigger(stepFields as Parameters<typeof trigger>[0])
    if (!valid) return

    // In edit mode the report already exists — skip creation. In new-draft mode, create lazily.
    if (!draftIdRef.current && !isEditMode) {
      try {
        const r = await createReport({
          template_id: template.template_id,
          template_version: template.version,
          intake_data: getValues() as unknown as Record<string, unknown>,
        })
        draftIdRef.current = r.id
        // Persist the new ID to localStorage immediately
        const entry: LocalDraft = { id: r.id, intake_data: getValues() }
        localStorage.setItem(localKey(template.template_id), JSON.stringify(entry))
        setLastSavedAt(new Date())
      } catch {
        // Non-fatal — form state is in localStorage, user can continue
      }
    } else {
      await saveDraft()
    }

    setCurrentStep(s => s + 1)
  }

  function handleBack() {
    setCurrentStep(s => s - 1)
  }

  async function handleSubmit() {
    if (getValues('risk_register').length === 0) {
      form.setError('risk_register', { message: 'At least one risk is required' })
      return
    }

    // Validate each step using the same per-step trigger as handleNext
    for (let i = 0; i < STEP_FIELD_NAMES.length; i++) {
      const valid = await trigger(STEP_FIELD_NAMES[i] as Parameters<typeof trigger>[0])
      if (!valid) {
        setCurrentStep(i)
        setSubmitError(`Step ${i + 1} has incomplete or invalid fields — please review.`)
        return
      }
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      let reportId: string
      if (draftIdRef.current) {
        await patchReport(draftIdRef.current, {
          intake_data: getValues() as unknown as Record<string, unknown>,
        })
        reportId = draftIdRef.current
      } else {
        const created = await createReport({
          template_id: template.template_id,
          template_version: template.version,
          intake_data: getValues() as unknown as Record<string, unknown>,
        })
        reportId = created.id
      }
      // Clear localStorage — only relevant for new drafts
      if (!isEditMode) localStorage.removeItem(localKey(template.template_id))
      navigate(`/reports/${reportId}/generate`)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const progressCounts = computeProgressCounts(watchValues)
  const statusMsg = bottomStatusMessage(currentStep, watchValues)
  const stepProps = { control, watch: watchValues, errors }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Breadcrumb + autosave */}
      <div className="flex items-center justify-between border-b px-6 py-2">
        <nav className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <span>reports</span>
          <ChevronRight className="h-3 w-3" />
          <span>new</span>
          <ChevronRight className="h-3 w-3" />
          <span>{template.template_id}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{supplierName || 'New SQR'}</span>
          <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
            {isEditMode ? 'editing' : 'draft'}
          </span>
        </nav>
        <AutosaveIndicator lastSavedAt={lastSavedAt} isSaving={isSaving} />
      </div>

      {/* Step progress bar */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-0">
          {STEP_LABELS.map((label, i) => {
            const isComplete = i < currentStep
            const isCurrent = i === currentStep
            return (
              <div key={i} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                      isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : isComplete
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-background text-muted-foreground',
                    )}
                  >
                    {isComplete ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      'hidden text-xs sm:inline',
                      isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div
                    className={cn(
                      'mx-3 h-px w-8 sm:w-16',
                      i < currentStep ? 'bg-primary' : 'bg-border',
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content + sidebar */}
      <div className="flex flex-1 gap-6 overflow-auto px-6 py-6">
        <div className="flex-1 min-w-0">
          {currentStep === 0 && <Step1HeaderInfo {...stepProps} />}
          {currentStep === 1 && <Step2QualificationContext {...stepProps} />}
          {currentStep === 2 && <Step3PerformanceMetrics {...stepProps} />}
          {currentStep === 3 && <Step4AuditScorecard control={control} errors={errors} />}
          {currentStep === 4 && <Step5RiskAndCARs control={control} errors={errors} />}

          {submitError && (
            <p className="mt-4 text-sm text-destructive">{submitError}</p>
          )}
        </div>

        <IntakeSidebar currentStep={currentStep + 1} progressCounts={progressCounts} />
      </div>

      {/* Bottom bar */}
      <div className="border-t px-6 py-3">
        {submitError && (
          <p className="mb-2 text-xs text-destructive">{submitError}</p>
        )}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            ← Back
          </Button>

          <span className="text-xs text-muted-foreground">{statusMsg}</span>

          {currentStep < STEP_LABELS.length - 1 ? (
            <Button type="button" size="sm" onClick={handleNext}>
              Next: {NEXT_LABELS[currentStep]}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting ? 'Submitting…' : 'Submit report →'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
