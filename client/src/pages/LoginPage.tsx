import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout } from '@/components/auth-layout'
import { login, devLogin } from '@/api'
import { useAuth } from '@/context/AuthContext'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { refresh } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
      await refresh()
      navigate('/')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDevLogin = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await devLogin()
      await refresh()
      navigate('/')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Log in" description="Welcome back to FitTrack">
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
        <div className="space-y-1.5">
          <label className="text-sm text-card-foreground" htmlFor="password">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-sm text-muted-foreground">
        <Link to="/forgot-password" className="hover:text-card-foreground">
          Forgot password?
        </Link>
        <Link to="/signup" className="hover:text-card-foreground">
          Create account
        </Link>
      </div>
      {import.meta.env.DEV && (
        <Button
          type="button"
          variant="ghost"
          className="mt-4 w-full text-xs text-muted-foreground"
          disabled={submitting}
          onClick={handleDevLogin}
        >
          Skip login (dev only)
        </Button>
      )}
    </AuthLayout>
  )
}
