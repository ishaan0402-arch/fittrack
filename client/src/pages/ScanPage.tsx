import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ScanLine, Search } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarcodeScanner } from '@/components/barcode-scanner'
import {
  getFoodByBarcode,
  logFood,
  createCustomFood,
  scanNutritionLabel,
  defaultMealType,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type Food,
  type MealType,
} from '@/api'

// Editable mirror of LabelScanResult — bundles both the "as labeled" values
// (used once, to define the created food's serving size and rate) and the
// "how much you're logging now" quantity, which can differ (e.g. 1.5 servings).
interface EditableLabelResult {
  productName: string
  servingSizeDescription: string
  servingSizeGrams: string
  quantityGrams: string
  calories: string
  proteinG: string
  carbsG: string
  fatG: string
  note: string
}

export function ScanPage() {
  const [manualCode, setManualCode] = useState('')
  const [looking, setLooking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [found, setFound] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [logged, setLogged] = useState(false)

  const [labelScanning, setLabelScanning] = useState(false)
  const [labelResult, setLabelResult] = useState<EditableLabelResult | null>(null)
  const [labelNotFound, setLabelNotFound] = useState(false)
  const [labelMealType, setLabelMealType] = useState<MealType>(defaultMealType())
  const [labelLogging, setLabelLogging] = useState(false)
  const [labelLogged, setLabelLogged] = useState(false)
  const labelInputRef = useRef<HTMLInputElement>(null)

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

  const handleLabelSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (labelInputRef.current) labelInputRef.current.value = ''
    if (!file) return

    setLabelScanning(true)
    setLabelResult(null)
    setLabelNotFound(false)
    setLabelLogged(false)
    setError(null)
    try {
      const result = await scanNutritionLabel(file)
      if (!result.labelFound) {
        setLabelNotFound(true)
        return
      }
      const servingSizeGrams = String(Math.round(result.servingSizeGrams))
      setLabelResult({
        productName: result.productName,
        servingSizeDescription: result.servingSizeDescription,
        servingSizeGrams,
        quantityGrams: servingSizeGrams,
        calories: String(Math.round(result.caloriesPerServing)),
        proteinG: String(Math.round(result.proteinG)),
        carbsG: String(Math.round(result.carbsG)),
        fatG: String(Math.round(result.fatG)),
        note: result.note,
      })
      setLabelMealType(defaultMealType())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLabelScanning(false)
    }
  }

  const updateLabelField = (patch: Partial<EditableLabelResult>) => {
    setLabelResult((r) => r && { ...r, ...patch })
  }

  // The label's serving size/calories are only used once, to give the
  // created food an accurate calories_per_100g rate — quantityGrams (how
  // much is actually being logged) is then scaled by that rate the same
  // way any other food in the app is, no separate math needed here.
  const confirmLabelLog = async () => {
    if (!labelResult) return
    const servingGrams = Number(labelResult.servingSizeGrams)
    const quantityGrams = Number(labelResult.quantityGrams)
    const calories = Number(labelResult.calories)
    if (!servingGrams || servingGrams <= 0 || !quantityGrams || quantityGrams <= 0 || !calories || calories < 0) {
      return
    }

    setLabelLogging(true)
    setError(null)
    try {
      const food = await createCustomFood({
        description: labelResult.productName.trim() || 'Scanned product',
        servingSizeGrams: servingGrams,
        calories,
        protein: Number(labelResult.proteinG) || undefined,
        carbs: Number(labelResult.carbsG) || undefined,
        fat: Number(labelResult.fatG) || undefined,
      })
      await logFood(food.id, quantityGrams, undefined, labelMealType)
      setLabelResult(null)
      setLabelLogged(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLabelLogging(false)
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

      <Card>
        <CardHeader>
          <CardTitle>Or scan the nutrition label</CardTitle>
          <CardDescription>
            No barcode match? Photograph the Nutrition Facts panel instead — reads the exact printed values.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={labelInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleLabelSelected}
          />

          {labelScanning ? (
            <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
              Reading label…
            </p>
          ) : labelResult ? (
            <div className="space-y-3 rounded-md bg-accent p-3">
              <Input
                value={labelResult.productName}
                onChange={(e) => updateLabelField({ productName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">As labeled: {labelResult.servingSizeDescription}</p>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={labelResult.servingSizeGrams}
                    onChange={(e) => updateLabelField({ servingSizeGrams: e.target.value })}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">g/serving</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={labelResult.calories}
                    onChange={(e) => updateLabelField({ calories: e.target.value })}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">kcal</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={labelResult.proteinG}
                    onChange={(e) => updateLabelField({ proteinG: e.target.value })}
                    className="w-16"
                  />
                  <span className="text-xs text-muted-foreground">P</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={labelResult.carbsG}
                    onChange={(e) => updateLabelField({ carbsG: e.target.value })}
                    className="w-16"
                  />
                  <span className="text-xs text-muted-foreground">C</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={labelResult.fatG}
                    onChange={(e) => updateLabelField({ fatG: e.target.value })}
                    className="w-16"
                  />
                  <span className="text-xs text-muted-foreground">F</span>
                </div>
              </div>
              {labelResult.note && <p className="text-xs text-muted-foreground">{labelResult.note}</p>}

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">Logging</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={labelResult.quantityGrams}
                  onChange={(e) => updateLabelField({ quantityGrams: e.target.value })}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">g</span>
                <select
                  value={labelMealType}
                  onChange={(e) => setLabelMealType(e.target.value as MealType)}
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none"
                >
                  {MEAL_TYPES.map((mt) => (
                    <option key={mt} value={mt}>
                      {MEAL_TYPE_LABELS[mt]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={confirmLabelLog} disabled={labelLogging}>
                  {labelLogging ? 'Logging…' : 'Log it'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setLabelResult(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {labelNotFound && (
                <p className="text-sm text-muted-foreground">
                  Couldn't find a readable nutrition label in that photo. Try getting the whole label in frame.
                </p>
              )}
              {labelLogged && (
                <p className="text-sm text-muted-foreground">
                  Added to today's diary.{' '}
                  <Link to="/" className="text-brand underline">
                    View diary
                  </Link>
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => labelInputRef.current?.click()}
              >
                <ScanLine />
                Scan nutrition label
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  )
}
