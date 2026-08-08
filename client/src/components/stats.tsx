import { cn } from '@/lib/utils'

export function RingStat({
  value,
  max,
  label,
  unit,
  color,
  size = 120,
}: {
  value: number
  max: number
  label: string
  unit: string
  color: string
  size?: number
}) {
  const stroke = size <= 80 ? 6 : 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const offset = circumference * (1 - pct)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            fill="none"
            stroke="var(--track)"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 300ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'font-semibold text-card-foreground',
              size <= 80 ? 'text-sm' : 'text-2xl'
            )}
          >
            {Math.round(value)}
          </span>
          {size > 80 && <span className="text-[11px] text-muted-foreground">{unit}</span>}
        </div>
      </div>
      <span
        className={cn(
          'text-center font-medium text-card-foreground',
          size <= 80 ? 'text-xs' : 'text-sm'
        )}
      >
        {label}
      </span>
    </div>
  )
}

export function MeterRow({
  label,
  consumed,
  target,
  unit,
}: {
  label: string
  consumed: number
  target?: number
  unit: string
}) {
  if (!target) {
    return (
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-card-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {consumed}
          {unit}
        </span>
      </div>
    )
  }

  const pct = Math.round((consumed / target) * 100)
  const barWidth = Math.min(100, Math.max(0, pct))
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-card-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {consumed} / {target}
          {unit} · {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-track">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            pct > 100 ? 'bg-destructive' : 'bg-brand'
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  )
}
