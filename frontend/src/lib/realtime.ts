import { supabase } from '@/lib/supabase'
import type { ReportField, ReportResponse } from '@/types/template'

function removeExisting(channelName: string) {
  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`)
  if (existing) supabase.removeChannel(existing)
}

export function subscribeToReportFields(
  reportId: string,
  onUpdate: (field: ReportField) => void,
) {
  const name = `report_fields:${reportId}`
  removeExisting(name)
  return supabase
    .channel(name)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'report_fields', filter: `report_id=eq.${reportId}` },
      (payload) => onUpdate(payload.new as ReportField),
    )
    .subscribe()
}

export function subscribeToReport(
  reportId: string,
  onUpdate: (report: Partial<ReportResponse>) => void,
) {
  const name = `reports:${reportId}`
  removeExisting(name)
  return supabase
    .channel(name)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'reports', filter: `id=eq.${reportId}` },
      (payload) => onUpdate(payload.new as Partial<ReportResponse>),
    )
    .subscribe()
}
