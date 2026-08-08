import { useState, type FormEvent } from 'react'
import { Loader2, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getNearbyRestaurants, type NearbyRestaurant } from '@/api'

export function RestaurantPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (name: string | null) => void
}) {
  const [manualName, setManualName] = useState('')
  const [locating, setLocating] = useState(false)
  const [nearby, setNearby] = useState<NearbyRestaurant[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!manualName.trim()) return
    onChange(manualName.trim())
    setManualName('')
    setNearby(null)
  }

  const handleUseLocation = () => {
    setError(null)
    if (!navigator.geolocation) {
      setError('Location isn’t available in this browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const results = await getNearbyRestaurants(
            position.coords.latitude,
            position.coords.longitude
          )
          setNearby(results)
          if (results.length === 0) setError('No restaurants found nearby.')
        } catch (e) {
          setError((e as Error).message)
        } finally {
          setLocating(false)
        }
      },
      () => {
        setError('Location permission was denied.')
        setLocating(false)
      }
    )
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-md bg-accent px-3 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <MapPin size={16} />
        </div>
        <span className="flex-1 text-sm font-semibold text-card-foreground">{value}</span>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          <X size={14} />
          Change
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <form onSubmit={handleManualSubmit} className="flex flex-1 gap-2">
          <Input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Type a restaurant, e.g. Chipotle"
            className="min-w-40 flex-1"
          />
          <Button type="submit" variant="outline">
            Set
          </Button>
        </form>
        <Button type="button" variant="outline" onClick={handleUseLocation} disabled={locating}>
          {locating ? <Loader2 className="animate-spin" /> : <MapPin />}
          {locating ? 'Locating…' : 'Use my location'}
        </Button>
      </div>

      {nearby && nearby.length > 0 && (
        <ul className="divide-y divide-border rounded-md border">
          {nearby.map((r) => (
            <li key={r.placeId}>
              <button
                type="button"
                onClick={() => {
                  onChange(r.name)
                  setNearby(null)
                }}
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-accent"
              >
                <span className="text-sm font-medium text-card-foreground">{r.name}</span>
                {r.vicinity && <span className="text-xs text-muted-foreground">{r.vicinity}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
