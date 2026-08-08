import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'

// The Barcode Detection API isn't in TypeScript's lib.dom.d.ts yet — declare
// just the shape we use.
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike
  }
}

const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window

  const stop = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    intervalRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setScanning(false)
  }

  useEffect(() => stop, [])

  const start = async () => {
    setError(null)
    if (!supported || !window.BarcodeDetector) {
      setError('Camera barcode scanning is not supported in this browser — try Chrome, or enter the code below.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)

      const detector = new window.BarcodeDetector({ formats: SCAN_FORMATS })
      intervalRef.current = window.setInterval(async () => {
        if (!videoRef.current) return
        try {
          const results = await detector.detect(videoRef.current)
          if (results.length > 0) {
            stop()
            onDetected(results[0].rawValue)
          }
        } catch {
          // A frame occasionally fails to decode — ignore and keep scanning.
        }
      }, 300)
    } catch {
      setError('Could not access the camera. Check your browser permissions and try again.')
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {scanning ? (
        <div className="space-y-3">
          <video
            ref={videoRef}
            className="aspect-video w-full rounded-md bg-black object-cover"
            muted
            playsInline
          />
          <Button variant="outline" onClick={stop}>
            Stop scanning
          </Button>
        </div>
      ) : (
        <Button onClick={start}>
          <Camera />
          Scan with camera
        </Button>
      )}
    </div>
  )
}
