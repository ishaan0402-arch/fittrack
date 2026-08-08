import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LogOut, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Diary' },
  { to: '/dashboard', label: 'Dashboard' },
]

export function AppLayout({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-foreground/60">{description}</p>
              <nav className="mt-2 flex gap-4">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'text-sm font-medium',
                      location.pathname === item.to
                        ? 'text-brand'
                        : 'text-foreground/60 hover:text-foreground'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="hidden text-sm text-foreground/60 sm:inline">{user?.email}</span>
            <Button size="icon" variant="ghost" aria-label="Coach" asChild>
              <Link to="/coach">
                <MessageCircle className="text-foreground/60" />
              </Link>
            </Button>
            <Button size="icon" variant="ghost" aria-label="Log out" onClick={logout}>
              <LogOut className="text-foreground/60" />
            </Button>
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}
