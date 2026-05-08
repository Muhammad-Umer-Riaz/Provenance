import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

export function TemplatesPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <span className="font-medium">Provenance</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="px-6 py-8">
        <h1 className="text-2xl font-semibold mb-2">Templates</h1>
        <p className="text-muted-foreground text-sm">Report templates will appear here.</p>
      </main>
    </div>
  )
}
