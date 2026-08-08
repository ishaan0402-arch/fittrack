import { useId } from 'react'

const OUTER_FLAME =
  'M20 2C14 9 8 12 8 21C8 29.2 13.4 36 20.5 36C27.8 36 33.4 30 32.4 21.6C31.6 15 25.6 12.5 25.2 7C25 12 20.5 14.5 20.5 19.5C20.5 22.5 18.3 24 16.5 24C14.3 24 12 21.8 12 18C12 12 20 10 20 2Z'
const INNER_FLAME =
  'M20.5 15C18 19 16.5 21 16.5 25.5C16.5 29.6 19 33 22.5 33C26.3 33 29 30 28.4 26C27.9 22.8 24.8 21.5 24.5 18.5C24.4 21 22 22 22 24.8C22 25.5 21.7 26 21 26C20.3 26 19.5 25.3 19.5 24C19.5 20.5 20.5 19 20.5 15Z'

/**
 * A hand-built flame mark, sized and colored by streak tier — the app's
 * signature moment, replacing a stock lucide icon dropped in a colored
 * circle. Tier escalation (size + glow) gives streaks a visible sense of
 * building momentum rather than a flat stat.
 */
export function StreakFlame({ tier, size = 72 }: { tier: 0 | 1 | 2 | 3 | 4; size?: number }) {
  const gradientId = useId()
  const glowId = useId()
  // Tier 0 (no streak) renders a dim, outline-only flame — present but unlit.
  const scale = 0.72 + tier * 0.07

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="8" y1="2" x2="32" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.82 0.15 70)" />
          <stop offset="55%" stopColor="oklch(0.7 0.19 42)" />
          <stop offset="100%" stopColor="oklch(0.6 0.21 30)" />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={tier >= 3 ? 3.2 : 1.6} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={`translate(20 20) scale(${scale}) translate(-20 -20)`}>
        {tier === 0 ? (
          <path d={OUTER_FLAME} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" opacity={0.6} />
        ) : (
          <g filter={tier >= 2 ? `url(#${glowId})` : undefined}>
            <path d={OUTER_FLAME} fill={`url(#${gradientId})`} />
            <path d={INNER_FLAME} fill="oklch(0.92 0.09 80)" opacity={0.85} />
          </g>
        )}
      </g>
    </svg>
  )
}

export function StreakDayPips({ days }: { days: boolean[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {days.map((logged, i) => (
        <span
          key={i}
          className="size-2.5 rounded-full"
          style={{ backgroundColor: logged ? 'var(--brand)' : 'var(--track)' }}
        />
      ))}
    </div>
  )
}
