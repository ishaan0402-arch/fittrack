import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '@/components/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  getCurrentFast,
  getFastingHistory,
  startFast,
  stopFast,
  type FastingSession,
} from '@/api'

const GOAL_OPTIONS = [12, 14, 16, 18, 20, 24]

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function FastingPage() {
  const [current, setCurrent] = useState<FastingSession | null | undefined>(undefined)
  const [history, setHistory] = useState<FastingSession[]>([])
  const [goalHours, setGoalHours] = useState(16)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    getCurrentFast().then(setCurrent).catch((e) => setError((e as Error).message))
    getFastingHistory().then(setHistory).catch((e) => setError((e as Error).message))
  }

  useEffect(refresh, [])

  useEffect(() => {
    if (!current) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [current])

  const elapsedMs = current ? now - new Date(current.startTime).getTime() : 0
  const goalMs = current ? Number(current.goalHours) * 3600 * 1000 : 0
  const progressPct = current ? Math.min(100, (elapsedMs / goalMs) * 100) : 0
  const pastGoal = current ? elapsedMs >= goalMs : false

  const handleStart = async () => {
    setBusy(true)
    setError(null)
    try {
      const session = await startFast(goalHours)
      setCurrent(session)
      setNow(Date.now())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleStop = async () => {
    setBusy(true)
    setError(null)
    try {
      await stopFast()
      setCurrent(null)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [history]
  )

  return (
    <AppLayout
      title="Fasting"
      description="Track an intermittent fasting window — start when your eating window closes, stop when it opens."
      maxWidth="max-w-2xl"
    >
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{current ? 'Fast in progress' : 'Start a fast'}</CardTitle>
          <CardDescription>
            {current
              ? `Goal: ${current.goalHours}h`
              : 'Pick a target window and start the clock.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {current === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : current ? (
            <>
              <div className="flex justify-center">
                <span
                  className={`font-hero text-5xl tabular-nums ${pastGoal ? 'text-brand' : 'text-card-foreground'}`}
                >
                  {formatDuration(elapsedMs)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
                <div
                  className="h-full bg-brand transition-[width]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {pastGoal
                  ? `Goal reached ${formatDuration(elapsedMs - goalMs)} ago`
                  : `${formatDuration(Math.max(0, goalMs - elapsedMs))} until goal`}
              </p>
              <div className="flex justify-center">
                <Button onClick={handleStop} disabled={busy} variant="outline">
                  {busy ? 'Ending…' : 'End fast'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap justify-center gap-2">
                {GOAL_OPTIONS.map((h) => (
                  <Button
                    key={h}
                    size="sm"
                    variant={goalHours === h ? 'default' : 'outline'}
                    onClick={() => setGoalHours(h)}
                  >
                    {h}h
                  </Button>
                ))}
              </div>
              <div className="flex justify-center">
                <Button onClick={handleStart} disabled={busy}>
                  {busy ? 'Starting…' : 'Start fast'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Your completed fasting windows.</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed fasts yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {sortedHistory.map((session) => {
                const durationMs =
                  new Date(session.endTime!).getTime() - new Date(session.startTime).getTime()
                const met = durationMs >= Number(session.goalHours) * 3600 * 1000
                return (
                  <li key={session.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-card-foreground">
                      {new Date(session.startTime).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className={met ? 'text-brand' : 'text-muted-foreground'}>
                      {formatDuration(durationMs)} / {session.goalHours}h goal
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  )
}
