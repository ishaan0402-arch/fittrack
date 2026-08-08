import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resendVerification } from '@/api'
import { useAuth } from '@/context/AuthContext'

export function VerifyEmailBanner() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)
  const [devLink, setDevLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!user || user.emailVerified || user.isGoogleAccount || dismissed) return null

  const handleResend = async () => {
    setSending(true)
    setError(null)
    try {
      const result = await resendVerification()
      setDevLink(result.devVerificationLink ?? null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-sidebar-border bg-accent px-4 py-2.5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-card-foreground">
          <Mail size={16} className="shrink-0 text-brand" />
          Verify your email address to secure your account.
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={handleResend} disabled={sending}>
            {sending ? 'Sending…' : 'Resend link'}
          </Button>
          <Button size="icon" variant="ghost" aria-label="Dismiss" onClick={() => setDismissed(true)}>
            <X size={16} />
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {devLink && (
        <p className="text-xs text-muted-foreground">
          No email sending is configured yet, so here's the link directly (dev only):{' '}
          <Link to={devLink.replace(window.location.origin, '')} className="break-all text-brand underline">
            {devLink}
          </Link>
        </p>
      )}
    </div>
  )
}
