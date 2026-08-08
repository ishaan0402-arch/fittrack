import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { ImagePlus, Images, Ruler, Trash2, Upload } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/empty-state'
import {
  getProgressPhotos,
  uploadProgressPhoto,
  deleteProgressPhoto,
  progressPhotoImageUrl,
  getLatestMeasurements,
  logMeasurement,
  deleteMeasurement,
  MEASUREMENT_TYPE_LABELS,
  type ProgressPhoto,
  type LatestMeasurement,
  type MeasurementType,
} from '@/api'

const MEASUREMENT_TYPES = Object.keys(MEASUREMENT_TYPE_LABELS) as MeasurementType[]

export function ProgressPage() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [measurements, setMeasurements] = useState<LatestMeasurement[]>([])
  const [measureType, setMeasureType] = useState<MeasurementType>('waist')
  const [measureValue, setMeasureValue] = useState('')
  const [savingMeasurement, setSavingMeasurement] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const refresh = () => {
    getProgressPhotos()
      .then(setPhotos)
      .catch((e) => setError((e as Error).message))
  }

  useEffect(refresh, [])

  const refreshMeasurements = () => {
    getLatestMeasurements()
      .then(setMeasurements)
      .catch((e) => setError((e as Error).message))
  }

  useEffect(refreshMeasurements, [])

  const handleLogMeasurement = async (e: FormEvent) => {
    e.preventDefault()
    const value = Number(measureValue)
    if (!value || value <= 0) return
    setSavingMeasurement(true)
    setError(null)
    try {
      await logMeasurement(measureType, value)
      setMeasureValue('')
      refreshMeasurements()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingMeasurement(false)
    }
  }

  const handleDeleteMeasurement = async (type: MeasurementType) => {
    const entry = measurements.find((m) => m.type === type)
    if (!entry) return
    try {
      await deleteMeasurement(entry.id)
      refreshMeasurements()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Choose a photo first.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      await uploadProgressPhoto(file, note.trim() || undefined)
      setNote('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteProgressPhoto(id)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <AppLayout
      title="Progress"
      description="Upload progress pics and keep a visual, dated record over time."
    >
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add a photo</CardTitle>
          <CardDescription>Optionally jot a note — how you're feeling, measurements, etc.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                dragOver ? 'border-brand bg-accent' : 'border-border hover:border-brand/50 hover:bg-accent/40'
              )}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Selected preview" className="size-28 rounded-md object-cover" />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-full bg-accent">
                  <ImagePlus className="text-brand" size={22} />
                </div>
              )}
              <p className="text-sm font-medium text-card-foreground">
                {file ? file.name : 'Drop a photo here, or click to browse'}
              </p>
              {!file && <p className="text-xs text-muted-foreground">JPG or PNG, up to 8MB</p>}
            </div>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" />
            <Button type="submit" disabled={uploading}>
              <Upload />
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Body measurements</CardTitle>
          <CardDescription>The scale doesn't see recomposition — a tape measure does.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogMeasurement} className="flex flex-wrap items-center gap-2">
            <select
              value={measureType}
              onChange={(e) => setMeasureType(e.target.value as MeasurementType)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none"
            >
              {MEASUREMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MEASUREMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={0}
              step="any"
              value={measureValue}
              onChange={(e) => setMeasureValue(e.target.value)}
              placeholder="cm"
              className="w-24"
            />
            <Button type="submit" size="sm" disabled={savingMeasurement || !measureValue}>
              <Ruler />
              Log
            </Button>
          </form>

          {measurements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No measurements logged yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {measurements.map((m) => (
                <div key={m.type} className="group relative rounded-md border p-3">
                  <p className="label-quiet">{MEASUREMENT_TYPE_LABELS[m.type]}</p>
                  <p className="font-hero mt-1 text-2xl text-card-foreground">
                    {Number(m.value_cm)}
                    <span className="ml-1 text-xs text-muted-foreground">cm</span>
                  </p>
                  <button
                    type="button"
                    aria-label={`Delete ${MEASUREMENT_TYPE_LABELS[m.type]} measurement`}
                    onClick={() => handleDeleteMeasurement(m.type)}
                    className="absolute right-1.5 top-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your photos</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <EmptyState icon={Images} message="Pictures tell the story numbers can't. Add your first." />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative overflow-hidden rounded-md border">
                  <img
                    src={progressPhotoImageUrl(photo.id)}
                    alt={photo.note ?? 'Progress photo'}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="space-y-1 p-2">
                    <p className="text-xs text-muted-foreground">
                      {new Date(photo.taken_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    {photo.note && (
                      <p className="truncate text-xs text-card-foreground" title={photo.note}>
                        {photo.note}
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete photo"
                    onClick={() => handleDelete(photo.id)}
                    className="absolute right-1 top-1 bg-card/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="text-destructive" size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  )
}
