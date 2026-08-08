import { useEffect, useRef } from 'react'
import { googleSignIn } from '@/api'

// Google Identity Services isn't in TypeScript's lib.dom.d.ts — declare just
// the shape this component uses.
interface GoogleCredentialResponse {
  credential: string
}
interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void
  renderButton(parent: HTMLElement, options: Record<string, string>): void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const CONFIGURED = Boolean(CLIENT_ID) && !CLIENT_ID!.startsWith('get_one_at_')

// Exported so pages can decide whether to show a "or use email" divider —
// there's no point rendering one above a button that isn't there.
export const googleSignInConfigured = CONFIGURED

let scriptLoadPromise: Promise<void> | null = null
function loadGoogleScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'))
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

// Renders nothing when VITE_GOOGLE_CLIENT_ID isn't configured — a disabled
// button on the login screen would just look broken; this feature quietly
// appears once real credentials are added, like every other gated
// integration in this app.
export function GoogleSignInButton({
  onSuccess,
  onError,
}: {
  onSuccess: () => void
  onError: (message: string) => void
}) {
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!CONFIGURED || !buttonRef.current) return
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google || !buttonRef.current) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID!,
          callback: async (response) => {
            try {
              await googleSignIn(response.credential)
              onSuccess()
            } catch (e) {
              onError((e as Error).message)
            }
          },
        })
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'filled_black',
          shape: 'pill',
          size: 'large',
          width: '336',
        })
      })
      .catch((e) => onError((e as Error).message))

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!CONFIGURED) return null

  return <div ref={buttonRef} className="flex justify-center" />
}
