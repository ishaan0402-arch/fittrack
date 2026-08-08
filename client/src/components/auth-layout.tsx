import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

export function AuthLayout({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-sidebar px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-brand opacity-[0.18] blur-[110px]" />
        <div className="absolute -bottom-40 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-brand opacity-[0.1] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo size={52} />
          <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">FitTrack</span>
        </div>

        <Card className={cn('w-full max-w-sm bg-card/95 backdrop-blur-sm', className)}>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  )
}
