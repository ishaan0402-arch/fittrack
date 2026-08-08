import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/auth-layout'
import { verifyEmail } from '@/api'
import { useAuth } from '@/context/AuthContext'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const [status, setStatus] = useState<'verifying' | 'done' | 'error'>('verifying')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Missing verification token.')
      return
    }
    verifyEmail(token)
      .then(async () => {
        await refresh()
        setStatus('done')
      })
      .catch((e) => {
        setError((e as Error).message)
        setStatus('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (status === 'verifying') {
    return (
      <AuthLayout title="Verifying your email">
        <p className="text-sm text-muted-foreground">One moment…</p>
      </AuthLayout>
    )
  }

  if (status === 'error') {
    return (
      <AuthLayout title="Verification failed">
        <p className="text-sm text-destructive">{error}</p>
        <Button className="mt-4 w-full" onClick={() => navigate('/')}>
          Go to FitTrack
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Email verified">
      <p className="text-sm text-card-foreground">Your email address is confirmed.</p>
      <Button className="mt-4 w-full" onClick={() => navigate('/')}>
        Continue
      </Button>
    </AuthLayout>
  )
}
