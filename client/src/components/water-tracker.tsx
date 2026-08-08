import { useEffect, useState, type FormEvent } from 'react'
import { Droplet, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getTodayWater, logWater, deleteWaterEntry, type TodayWater } from '@/api'

const QUICK_AMOUNTS = [250, 500]

export function WaterTracker() {
  const [water, setWater] = useState<TodayWater | null>(null)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    getTodayWater()
      .then(setWater)
      .catch((e) => setError((e as Error).message))
  }

  useEffect(refresh, [])

  const add = async (amountMl: number) => {
    setError(null)
    try {
      await logWater(amountMl)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleCustomSubmit = (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(custom)
    if (!amount || amount <= 0) return
    add(amount)
    setCustom('')
  }

  const undoLast = async () => {
    if (!water || water.entries.length === 0) return
    setError(null)
    try {
      await deleteWaterEntry(water.entries[water.entries.length - 1].id)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!water) return null

  const pct = water.goalMl > 0 ? Math.min(1, water.totalMl / water.goalMl) : 0

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent">
          <Droplet className="text-brand" size={18} />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="font-hero text-2xl text-card-foreground">{water.totalMl}</span>
            <span className="text-xs text-muted-foreground">/ {water.goalMl} ml</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_AMOUNTS.map((amount) => (
          <Button key={amount} size="sm" variant="outline" onClick={() => add(amount)}>
            +{amount}ml
          </Button>
        ))}
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Custom ml"
            className="h-8 w-24"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!custom}>
            Add
          </Button>
        </form>
        {water.entries.length > 0 && (
          <Button size="sm" variant="ghost" onClick={undoLast} aria-label="Undo last entry">
            <Undo2 size={14} />
            Undo
          </Button>
        )}
      </div>
    </div>
  )
}
