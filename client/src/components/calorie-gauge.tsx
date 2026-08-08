const WIDTH = 360
const HEIGHT = 164
const CX = WIDTH / 2
const CY = 150
const RADIUS = 140
const STROKE = 22

// Point on the gauge's semicircle at a given progress (0 = left end / 9
// o'clock, 1 = right end / 3 o'clock, sweeping up through the top).
function pointAt(pct: number) {
  const angle = Math.PI - pct * Math.PI // radians: pi -> 0
  return {
    x: CX + RADIUS * Math.cos(angle),
    y: CY - RADIUS * Math.sin(angle),
  }
}

function arcPath(fromPct: number, toPct: number) {
  const start = pointAt(fromPct)
  const end = pointAt(toPct)
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 0 1 ${end.x} ${end.y}`
}

/**
 * The app's signature stat display: a single arc gauge for calories
 * consumed vs. target, with the consumed number as giant hero text —
 * replacing the old three-donut-ring row (which read like a default
 * charting-library widget, not something specific to FitTrack).
 */
export function CalorieGauge({
  consumed,
  target,
}: {
  consumed: number
  target: number
}) {
  const remaining = target - consumed
  const overTarget = remaining < 0
  const pct = target > 0 ? Math.min(1, Math.max(0, consumed / target)) : 0
  const fillPct = overTarget ? 1 : pct

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: WIDTH, height: HEIGHT }}>
        <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          <path
            d={arcPath(0, 1)}
            fill="none"
            stroke="var(--track)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {fillPct > 0 && (
            <path
              d={arcPath(0, fillPct)}
              fill="none"
              stroke="var(--brand)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              style={{ transition: 'd 300ms ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <span className="font-hero text-7xl text-card-foreground">{Math.round(consumed)}</span>
          <span className="label-quiet mt-1">
            {overTarget ? `${Math.round(Math.abs(remaining))} over target` : 'kcal consumed'}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-12">
        <div className="flex flex-col items-center">
          <span className="font-hero text-2xl text-muted-foreground">{Math.round(target)}</span>
          <span className="label-quiet mt-0.5">Target</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col items-center">
          <span className={`font-hero text-2xl ${overTarget ? 'text-brand' : 'text-card-foreground'}`}>
            {overTarget ? `+${Math.round(Math.abs(remaining))}` : Math.round(Math.max(remaining, 0))}
          </span>
          <span className="label-quiet mt-0.5">{overTarget ? 'Over' : 'Remaining'}</span>
        </div>
      </div>
    </div>
  )
}
