import { supabase } from '@/lib/supabase'
import type { ReportCreateRequest, ReportResponse, TemplateListItem } from '@/types/template'

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
