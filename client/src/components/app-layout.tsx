import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

export function AppLayout({
  title,
  description,
  children,
  maxWidth = 'max-w-2xl',
}: {
  title: string
  description: string
  children: ReactNode
  maxWidth?: string
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-svh bg-background">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out lg:static lg:translate-x-0',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar onNavigate={() => setMobileNavOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(true)}
            className="flex size-9 items-center justify-center rounded-md text-sidebar-foreground hover:bg-white/5"
          >
            <Menu size={20} />
          </button>
          <Logo size={24} />
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">FitTrack</span>
        </div>

        <main className="flex flex-1 flex-col">
          <div className={cn('mx-auto flex w-full flex-1 flex-col space-y-8 px-4 py-6 sm:px-6 sm:py-8', maxWidth)}>
            <header>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-foreground/60">{description}</p>
            </header>

            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
