import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { ProfileSetupPage } from '@/pages/ProfileSetupPage'
import { DiaryPage } from '@/pages/DiaryPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CoachPage } from '@/pages/CoachPage'

function LoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background text-sm text-foreground/60">
      Loading…
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireProfile({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!user.hasProfile) return <Navigate to="/profile-setup" replace />
  return <>{children}</>
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthed>
            <SignupPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <RedirectIfAuthed>
            <ForgotPasswordPage />
          </RedirectIfAuthed>
        }
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/profile-setup"
        element={
          <RequireAuth>
            <ProfileSetupPage />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireProfile>
            <DiaryPage />
          </RequireProfile>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireProfile>
            <DashboardPage />
          </RequireProfile>
        }
      />
      <Route
        path="/coach"
        element={
          <RequireProfile>
            <CoachPage />
          </RequireProfile>
        }
      />
    </Routes>
  )
}

export default App
