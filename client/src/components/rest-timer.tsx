import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const PRESETS = [30, 60, 90, 120, 180]

// A short synthesized tone rather than a bundled audio file — works with
// zero assets and degrades silently (visual countdown to 00:00 is still
// clear) if the browser blocks audio before any user interaction.
function playBeep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    // Audio unavailable — nothing to do, the visual countdown already made it obvious.
  }
}

export function RestTimer() {
  const [duration, setDuration] = useState(90)
  const [remaining, setRemaining] = useState(90)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false)
          playBeep()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  const start = (seconds: number) => {
    setDuration(seconds)
    setRemaining(seconds)
    setRunning(true)
  }

  const resume = () => {
    if (remaining > 0) setRunning(true)
  }

  const pause = () => setRunning(false)

  const reset = () => {
    setRunning(false)
    setRemaining(duration)
  }

  const mm = Math.floor(remaining / 60)
  const ss = remaining % 60
  const atZero = remaining === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rest timer</CardTitle>
        <CardDescription>Countdown between sets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <span
            className={`font-hero text-6xl tabular-nums ${atZero ? 'text-brand' : 'text-card-foreground'}`}
          >
            {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {PRESETS.map((s) => (
            <Button key={s} size="sm" variant="outline" onClick={() => start(s)}>
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </Button>
          ))}
        </div>
        <div className="flex justify-center gap-2">
          {running ? (
            <Button size="sm" variant="outline" onClick={pause}>
              <Pause size={15} />
              Pause
            </Button>
          ) : (
            <Button size="sm" onClick={resume} disabled={atZero}>
              <Play size={15} />
              {remaining === duration ? 'Start' : 'Resume'}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw size={15} />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
