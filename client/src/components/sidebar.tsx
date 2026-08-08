import { Link, useLocation } from 'react-router-dom'
import {
  Apple,
  Dumbbell,
  Image,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  NotebookText,
  ScanBarcode,
  Settings,
  UtensilsCrossed,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/', label: 'Diary', icon: NotebookText },
  { to: '/foods', label: 'Foods', icon: Apple },
  { to: '/meals', label: 'Meals', icon: UtensilsCrossed },
  { to: '/scan', label: 'Scan', icon: ScanBarcode },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: Image },
  { to: '/coach', label: 'Coach', icon: MessageCircle },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <aside className="flex h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 py-6">
        <Logo size={32} />
        <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
          FitTrack
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.to
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-active text-sidebar-active-foreground'
                  : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground'
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border px-5 py-4">
        <p className="truncate text-xs text-sidebar-muted">{user?.email}</p>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm font-medium text-sidebar-muted hover:text-sidebar-foreground"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </aside>
  )
}
