import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent">
        <Icon className="text-muted-foreground" size={22} />
      </div>
      <p className="max-w-64 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
