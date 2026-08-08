import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLayout } from '@/components/app-layout'
import { getCoachMessages, sendCoachMessage, type CoachMessage } from '@/api'
import { cn } from '@/lib/utils'

const STARTER_PROMPTS = [
  'How am I doing this week?',
  'Suggest a dinner under 600 calories',
  'Am I getting enough protein?',
  'Give me a quick pep talk',
]

export function CoachPage() {
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getCoachMessages()
      .then(setMessages)
      .catch((e) => setError((e as Error).message))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return
    setDraft('')
    setError(null)
    setMessages((m) => [
      ...m,
      { id: Date.now(), role: 'user', content: text, created_at: new Date().toISOString() },
    ])
    setSending(true)
    try {
      const reply = await sendCoachMessage(text)
      setMessages((m) => [...m, reply])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await sendMessage(draft.trim())
  }

  return (
    <AppLayout title="Coach" description="Your personal fitness and nutrition coach.">
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>
            Knows your profile and today's log — ask about your progress, nutrition, or
            motivation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Say hello — ask how you're doing today, or what to eat for dinner.
                </p>
                <div className="flex flex-wrap gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="rounded-full border border-border bg-accent px-3 py-1.5 text-xs text-card-foreground transition-colors hover:border-brand/50 hover:bg-accent/70"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-brand text-brand-foreground'
                      : 'bg-accent text-accent-foreground'
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-accent px-3 py-2 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask your coach anything…"
              disabled={sending}
            />
            <Button type="submit" disabled={sending || !draft.trim()}>
              <Send />
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  )
}
