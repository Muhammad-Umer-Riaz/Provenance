import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getReports } from '@/lib/api'
import type { ReportResponse } from '@/types/template'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  generating: 'secondary',
  review: 'default',
  approved: 'default',
  exported: 'secondary',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function ReportsPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [reports, setReports] = useState<ReportResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getReports()
      .then(setReports)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load reports'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <span className="font-medium">Provenance</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>

      <main className="px-6 py-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">Your qualification report drafts.</p>
          </div>
          <Button onClick={() => navigate('/templates')}>New report</Button>
        </div>

        {loading && (
          <p className="text-muted-foreground text-sm">Loading…</p>
        )}
        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}
        {!loading && !error && reports.length === 0 && (
          <div className="text-center py-16 border rounded-lg text-muted-foreground">
            <p className="font-medium">No reports yet.</p>
            <p className="text-sm mt-1 mb-4">Start from a template to create your first report.</p>
            <Button variant="outline" onClick={() => navigate('/templates')}>
              Browse templates
            </Button>
          </div>
        )}
        {reports.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Supplier</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Template</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {reports.map(r => {
                  const supplierName =
                    typeof r.intake_data.supplier_name === 'string'
                      ? r.intake_data.supplier_name
                      : '—'
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{supplierName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.template_id} v{r.template_version}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" disabled>
                          View
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
