export interface IntakeColumnSchema {
  name: string
  label: string
  type: string
  editable?: boolean
  required?: boolean
  validation?: { min?: number; max?: number }
  values?: string[]
}

export interface IntakeFieldSchema {
  type: string
  required: boolean
  label: string
  values?: string[]
  columns?: IntakeColumnSchema[]
  default_rows?: Record<string, unknown>[]
  min_rows?: number
  validation?: { min?: number; max?: number; pattern?: string }
  condition?: string
}

export interface TemplateListItem {
  template_id: string
  version: string
  name: string
  description: string
  intake: Record<string, IntakeFieldSchema>
  strategy_counts?: Record<string, number>
  section_count?: number
  field_count?: number
}

export interface ReportCreateRequest {
  template_id: string
  template_version: string
  intake_data: Record<string, unknown>
}

export interface ReportUpdateRequest {
  intake_data: Record<string, unknown>
  status?: string
}

export interface ReportResponse {
  id: string
  template_id: string
  template_version: string
  status: string
  intake_data: Record<string, unknown>
  created_at: string
  updated_at: string
  score: number | null
  verdict: string | null
}
