import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getTemplates } from '@/lib/api'
import type { TemplateListItem } from '@/types/template'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function TemplatesPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load templates'))
      .finally(() => setLoading(false))
  }, [])

  function startReport(template: TemplateListItem) {
    navigate('/reports/new', { state: { template } })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <span className="font-medium">Provenance</span>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
            My Reports
          </Button>
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="px-6 py-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Templates</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Select a report template to begin a new qualification.
        </p>

        {loading && <p className="text-muted-foreground text-sm">Loading templates…</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <Card key={`${t.template_id}@${t.version}`} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">{t.name}</CardTitle>
                <CardDescription>v{t.version}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={() => startReport(t)}>
                  Start report
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
