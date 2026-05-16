import { supabase } from '@/lib/supabase'
import type { ReportCreateRequest, ReportUpdateRequest, ReportResponse, ReportField, TemplateListItem } from '@/types/template'

const BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...init?.headers } })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }
  return res.json() as Promise<T>
}

export async function getTemplates(): Promise<TemplateListItem[]> {
  const data = await apiFetch<{ templates: TemplateListItem[] }>('/api/templates/')
  return data.templates
}

export async function createReport(body: ReportCreateRequest): Promise<ReportResponse> {
  return apiFetch<ReportResponse>('/api/reports/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getReports(): Promise<ReportResponse[]> {
  const data = await apiFetch<{ reports: ReportResponse[] }>('/api/reports/')
  return data.reports
}

export async function patchReport(id: string, body: ReportUpdateRequest): Promise<ReportResponse> {
  return apiFetch<ReportResponse>(`/api/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteReport(id: string): Promise<void> {
  await apiFetch<void>(`/api/reports/${id}`, { method: 'DELETE' })
}

export async function getReport(id: string): Promise<ReportResponse> {
  return apiFetch<ReportResponse>(`/api/reports/${id}`)
}

export async function getReportFields(id: string): Promise<ReportField[]> {
  const data = await apiFetch<{ fields: ReportField[] }>(`/api/reports/${id}/fields`)
  return data.fields
}

export async function generateReport(id: string): Promise<{ status: string; report_id: string }> {
  return apiFetch(`/api/reports/${id}/generate`, { method: 'POST' })
}

export async function updateField(
  reportId: string,
  fieldId: string,
  body: { value?: string; status?: string },
): Promise<ReportField> {
  return apiFetch<ReportField>(`/api/reports/${reportId}/fields/${fieldId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function regenerateField(
  reportId: string,
  fieldId: string,
): Promise<{ status: string }> {
  return apiFetch(`/api/reports/${reportId}/fields/${fieldId}/regenerate`, { method: 'POST' })
}

type SaveFilePicker = (opts: {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}) => Promise<FileSystemFileHandle>

const mimeTypes: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  json: 'application/json',
}

export async function exportReport(
  reportId: string,
  format: 'pdf' | 'docx' | 'json',
): Promise<void> {
  const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker

  // Acquire the file handle BEFORE any await — user-gesture token is still alive here.
  // Chrome loses the token after the first await, causing a.click() to ignore the
  // download attribute and produce UUID-named entries that never land on disk.
  let fileHandle: FileSystemFileHandle | undefined
  if (picker) {
    try {
      fileHandle = await picker({
        suggestedName: `report-${reportId}.${format}`,
        types: [{ description: `${format.toUpperCase()} file`, accept: { [mimeTypes[format]]: [`.${format}`] } }],
      })
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return
      // Any other error (e.g. SecurityError in automated browsers) — fall through to blob download
    }
  }

  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(
    `${BASE}/api/reports/${reportId}/export?format=${format}`,
    { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } },
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Export failed (${res.status}): ${body}`)
  }
  const blob = await res.blob()

  if (fileHandle) {
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    return
  }

  // Fallback: Firefox, Safari, or browsers where showSaveFilePicker is unavailable
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report-${reportId}.${format}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
