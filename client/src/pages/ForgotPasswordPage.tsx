import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout } from '@/components/auth-layout'
import { requestPasswordReset } from '@/api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ message: string; devResetLink?: string } | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      setResult(await requestPasswordReset(email))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Reset your password" description="We'll email you a link to choose a new one">
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-card-foreground">{result.message}</p>
          {result.devResetLink && (
            <div className="space-y-1 rounded-md bg-accent p-3 text-xs text-muted-foreground">
              <p>No email sending is configured yet, so here's the link directly (dev only):</p>
              <Link
                to={result.devResetLink.replace(window.location.origin, '')}
                className="block break-all text-brand underline"
              >
                {result.devResetLink}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-card-foreground" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <div className="mt-4 text-sm text-muted-foreground">
        <Link to="/login" className="hover:text-card-foreground">
          Back to login
        </Link>
      </div>
    </AuthLayout>
  )
}
