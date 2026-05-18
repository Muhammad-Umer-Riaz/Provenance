import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IntakeWizard } from '@/components/forms/IntakeWizard'
import { getTemplates } from '@/lib/api'
import type { TemplateListItem } from '@/types/template'
import { useAuth } from '@/context/AuthContext'

interface LocationState {
  template?: TemplateListItem
  editReport?: { id: string; intake_data: Record<string, unknown>; template_id?: string; template_version?: string }
}

export function NewReportPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const state = (location.state as LocationState | null) ?? {}
  const passedTemplate = state.template
  const editReport = state.editReport

  const [template, setTemplate] = useState<TemplateListItem | null>(passedTemplate ?? null)
  const [loading, setLoading] = useState(!passedTemplate)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (passedTemplate) return
    getTemplates()
      .then(ts => {
        if (ts.length === 0) { setError('No templates available.'); return }
        if (editReport?.template_id) {
          const match = ts.find(t => t.template_id === editReport.template_id)
          setTemplate(match ?? ts[0])
        } else {
          setTemplate(ts[0])
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load template'))
      .finally(() => setLoading(false))
  }, [passedTemplate])

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
              <button
                onClick={() => navigate('/templates')}
                className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Templates
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="border-b-2 border-primary px-3 py-1 text-sm font-medium"
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

      {loading && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading template…
        </div>
      )}
      {error && (
        <div className="flex flex-1 items-center justify-center text-destructive">{error}</div>
      )}
      {template && (
        <IntakeWizard template={template} editReport={editReport} />
      )}
    </div>
  )
}
