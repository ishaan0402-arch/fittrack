import { useEffect, useMemo, useState } from 'react'
import { Activity, Bike, Footprints, Mountain, RefreshCw, Waves } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineTrendChart } from '@/components/trend-charts'
import {
  getStravaStatus,
  getStravaActivities,
  getStravaWeeklyDistance,
  syncStrava,
  disconnectStrava,
  type StravaStatus,
  type StravaActivity,
  type StravaWeeklyDistance,
} from '@/api'

const TYPE_ICON: Record<string, typeof Activity> = {
  Run: Footprints,
  Walk: Footprints,
  Hike: Mountain,
  Ride: Bike,
  VirtualRide: Bike,
  Swim: Waves,
}

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)}km`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatPace(distanceMeters: number, movingTimeSeconds: number): string | null {
  if (distanceMeters <= 0) return null
  const minPerKm = movingTimeSeconds / 60 / (distanceMeters / 1000)
  const min = Math.floor(minPerKm)
  const sec = Math.round((minPerKm - min) * 60)
  return `${min}:${String(sec).padStart(2, '0')}/km`
}

// Only shown for props indicating the redirect-back landed here — a query
// param FastingPage-style query check would need react-router's useSearchParams,
// but WorkoutsPage doesn't otherwise use it, so the parent reads it and
// passes down a plain boolean instead of this component owning routing concerns.
export function StravaCard({ justConnected }: { justConnected?: boolean }) {
  const [status, setStatus] = useState<StravaStatus | null>(null)
  const [activities, setActivities] = useState<StravaActivity[]>([])
  const [weekly, setWeekly] = useState<StravaWeeklyDistance[]>([])
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    getStravaStatus()
      .then((s) => {
        setStatus(s)
        if (s.connected) {
          getStravaActivities().then(setActivities).catch((e) => setError((e as Error).message))
          getStravaWeeklyDistance().then(setWeekly).catch((e) => setError((e as Error).message))
        }
      })
      .catch((e) => setError((e as Error).message))
  }

  useEffect(refresh, [])

  useEffect(() => {
    if (justConnected) {
      setSyncing(true)
      syncStrava()
        .then(refresh)
        .catch((e) => setError((e as Error).message))
        .finally(() => setSyncing(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justConnected])

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    try {
      await syncStrava()
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    setError(null)
    try {
      await disconnectStrava()
      setStatus({ connected: false })
      setActivities([])
      setWeekly([])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const chartData = useMemo(
    () => weekly.map((w) => ({ date: w.week_start, value: Number(w.distance_km) })),
    [weekly]
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Strava</CardTitle>
          <CardDescription>
            {status?.connected ? 'Synced activities from your Strava account.' : 'Connect Strava to bring in your runs, rides, and more.'}
          </CardDescription>
        </div>
        {status?.connected && (
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? 'animate-spin' : undefined} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {!status ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !status.connected ? (
          <Button asChild>
            <a href="/api/strava/connect">Connect Strava</a>
          </Button>
        ) : (
          <>
            <LineTrendChart
              data={chartData}
              unit="km"
              decimals={1}
              emptyMessages={{
                none: 'Sync your Strava activities to see your weekly distance trend.',
                some: 'Sync a few more weeks to see your weekly distance trend.',
              }}
            />

            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activities synced yet — hit "Sync now" to pull in your recent Strava activity.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {activities.map((a) => {
                  const Icon = TYPE_ICON[a.type] ?? Activity
                  const distance = Number(a.distanceMeters)
                  const pace = a.type === 'Run' ? formatPace(distance, a.movingTimeSeconds) : null
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                      <Icon size={16} className="shrink-0 text-brand" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-card-foreground">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          {distance > 0 && ` · ${formatDistance(distance)}`} · {formatDuration(a.movingTimeSeconds)}
                          {pace && ` · ${pace}`}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <Button size="sm" variant="ghost" onClick={handleDisconnect}>
              Disconnect Strava
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
