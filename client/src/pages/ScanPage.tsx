import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarcodeScanner } from '@/components/barcode-scanner'
import { getFoodByBarcode, logFood, type Food } from '@/api'

export function ScanPage() {
  const [manualCode, setManualCode] = useState('')
  const [looking, setLooking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [found, setFound] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [logged, setLogged] = useState(false)

  const lookup = async (code: string) => {
    setLooking(true)
    setError(null)
    setFound(null)
    setLogged(false)
    setLastCode(code)
    try {
      const food = await getFoodByBarcode(code)
      if (!food) {
        setError(`No food found for barcode ${code}.`)
        return
      }
      setFound(food)
      setQuantity(food.serving_size_grams ? String(Number(food.serving_size_grams)) : '100')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLooking(false)
    }
  }

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    lookup(manualCode.trim())
  }

  const handleLog = async () => {
    if (!found) return
    const amount = Number(quantity)
    if (!amount || amount <= 0) return
    try {
      await logFood(found.id, amount)
      setLogged(true)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <AppLayout title="Scan" description="Scan a barcode to find and log packaged food in seconds.">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scan a barcode</CardTitle>
          <CardDescription>Point your camera at the barcode on a package.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeScanner onDetected={lookup} />

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or type a barcode number"
              inputMode="numeric"
            />
            <Button type="submit" variant="outline" disabled={looking}>
              <Search />
              {looking ? 'Looking up…' : 'Look up'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {looking && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Looking up barcode {lastCode}…</p>
          </CardContent>
        </Card>
      )}

      {found && (
        <Card>
          <CardHeader>
            <CardTitle>{found.description}</CardTitle>
            <CardDescription>{Math.round(Number(found.calories_per_100g))} kcal / 100g</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">grams</span>
              <Button onClick={handleLog} disabled={logged}>
                {logged ? 'Logged ✓' : 'Log it'}
              </Button>
            </div>
            {logged && (
              <p className="text-sm text-muted-foreground">
                Added to today's diary.{' '}
                <Link to="/" className="text-brand underline">
                  View diary
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </AppLayout>
  )
}
