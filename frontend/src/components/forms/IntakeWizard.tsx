import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { TemplateListItem } from '@/types/template'
import { createReport } from '@/lib/api'
import { buildStepSchema } from '@/lib/buildIntakeSchema'
import { Step1HeaderInfo } from './steps/Step1HeaderInfo'
import { Step2QualificationContext } from './steps/Step2QualificationContext'
import { Step3PerformanceMetrics } from './steps/Step3PerformanceMetrics'
import { Step4AuditScorecard } from './steps/Step4AuditScorecard'
import { Step5RiskAndCARs } from './steps/Step5RiskAndCARs'

// ── Shared form value type ─────────────────────────────────────────────────────

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
  // Step 1
  supplier_name: string
  supplier_country: string
  supplier_contact_name?: string
  supplier_contact_title?: string
  commodity_category: string
  evaluator_name: string
  duns_number?: string
  review_period: string
  // Step 2
  qualification_type: string
  previous_verdict?: string
  previous_composite_score?: number
  prev_otd_rate_pct?: number
  prev_defect_rate_pct?: number
  prev_invoice_accuracy_pct?: number
  // Step 3
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
  // Step 4
  audit_scores: AuditScoreRow[]
  // Step 5
  risk_register: RiskRegisterRow[]
  corrective_actions: CARRow[]
}

// ── Step metadata ──────────────────────────────────────────────────────────────

const STEPS = [
  { title: 'Header Info' },
  { title: 'Qualification Context' },
  { title: 'Performance & Certifications' },
  { title: 'Audit Scorecard' },
  { title: 'Risk & CARs' },
]

const STEP_FIELD_NAMES: Array<Array<keyof IntakeFormValues>> = [
  ['supplier_name', 'supplier_country', 'commodity_category', 'evaluator_name', 'review_period'],
  ['qualification_type'],
  ['otd_rate_pct', 'defect_rate_pct', 'invoice_accuracy_pct', 'open_ncr_count'],
  ['audit_scores'],
  ['risk_register'],
]

// ── Default audit scorecard rows ───────────────────────────────────────────────

const DEFAULT_AUDIT_ROWS: AuditScoreRow[] = [
  { criterion: 'Quality management system', weight: 0.25, score: '' },
  { criterion: 'On-time delivery history', weight: 0.25, score: '' },
  { criterion: 'Financial stability', weight: 0.20, score: '' },
  { criterion: 'Technical / engineering capability', weight: 0.15, score: '' },
  { criterion: 'Corrective action responsiveness', weight: 0.10, score: '' },
  { criterion: 'Sustainability & compliance', weight: 0.05, score: '' },
]

// ── Wizard ─────────────────────────────────────────────────────────────────────

interface Props {
  template: TemplateListItem
}

export function IntakeWizard({ template }: Props) {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fullSchema = useMemo(
    () => buildStepSchema(template.intake, Object.keys(template.intake)),
    [template.intake],
  )

  const form = useForm<IntakeFormValues>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
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
    },
    mode: 'onTouched',
  })

  const { control, watch, formState: { errors }, trigger, getValues } = form

  const watchValues = watch()

  async function handleNext() {
    const stepFields = STEP_FIELD_NAMES[currentStep]
    const valid = await trigger(stepFields as Parameters<typeof trigger>[0])
    if (!valid) return
    setCurrentStep(s => s + 1)
  }

  function handleBack() {
    setCurrentStep(s => s - 1)
  }

  async function handleSubmit() {
    const valid = await trigger()
    if (!valid) {
      const errs = form.formState.errors
      for (let i = 0; i < STEP_FIELD_NAMES.length; i++) {
        if (STEP_FIELD_NAMES[i].some(f => errs[f as keyof typeof errs] != null)) {
          setCurrentStep(i)
          setSubmitError(`Step ${i + 1} has incomplete or invalid fields — please review before submitting.`)
          return
        }
      }
      return
    }
    if (form.getValues('risk_register').length === 0) {
      form.setError('risk_register', { message: 'At least one risk is required' })
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      await createReport({
        template_id: template.template_id,
        template_version: template.version,
        intake_data: getValues() as unknown as Record<string, unknown>,
      })
      navigate('/reports')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const stepProps = { control, watch: watchValues, errors }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className={[
                  'h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium',
                  i < currentStep
                    ? 'bg-primary text-primary-foreground'
                    : i === currentStep
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                      : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span
                className={[
                  'text-sm hidden sm:inline',
                  i === currentStep ? 'font-medium' : 'text-muted-foreground',
                ].join(' ')}
              >
                {step.title}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={['h-px w-4 sm:w-8', i < currentStep ? 'bg-primary' : 'bg-border'].join(' ')} />
            )}
          </div>
        ))}
      </div>

      <h2 className="text-xl font-semibold mb-1">{STEPS[currentStep].title}</h2>
      <p className="text-sm text-muted-foreground mb-6">Step {currentStep + 1} of {STEPS.length}</p>

      <Separator className="mb-6" />

      {/* Step content */}
      <div className="space-y-5">
        {currentStep === 0 && <Step1HeaderInfo {...stepProps} />}
        {currentStep === 1 && <Step2QualificationContext {...stepProps} />}
        {currentStep === 2 && <Step3PerformanceMetrics {...stepProps} />}
        {currentStep === 3 && <Step4AuditScorecard control={control} errors={errors} />}
        {currentStep === 4 && <Step5RiskAndCARs control={control} errors={errors} />}
      </div>

      {submitError && (
        <p className="text-sm text-destructive mt-4">{submitError}</p>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          Back
        </Button>
        {currentStep < STEPS.length - 1 ? (
          <Button type="button" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Report'}
          </Button>
        )}
      </div>
    </div>
  )
}
