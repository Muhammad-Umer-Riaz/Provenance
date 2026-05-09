import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IntakeWizard } from '@/components/forms/IntakeWizard'
import { getTemplates } from '@/lib/api'
import type { TemplateListItem } from '@/types/template'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

export function NewReportPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const passedTemplate = (location.state as { template?: TemplateListItem } | null)?.template
  const [template, setTemplate] = useState<TemplateListItem | null>(passedTemplate ?? null)
  const [loading, setLoading] = useState(!passedTemplate)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (passedTemplate) return
    getTemplates()
      .then(ts => {
        if (ts.length === 0) { setError('No templates available.'); return }
        setTemplate(ts[0])
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load template'))
      .finally(() => setLoading(false))
  }, [passedTemplate])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/templates')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Templates
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">New Report</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>

      <main>
        {loading && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading template…
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-64 text-destructive">{error}</div>
        )}
        {template && <IntakeWizard template={template} />}
      </main>
    </div>
  )
}
