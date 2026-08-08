import { useMemo, useState, type MouseEvent } from 'react'
import { LineChart } from 'lucide-react'

const MIN_POINTS_FOR_TREND = 3

function EmptyTrendState({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-center"
      style={{ height: CHART_HEIGHT }}
    >
      <LineChart className="text-muted-foreground/50" size={28} />
      <p className="max-w-56 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

const CHART_WIDTH = 640
const CHART_HEIGHT = 220
const PAD_LEFT = 44
const PAD_RIGHT = 12
const PAD_TOP = 16
const PAD_BOTTOM = 28
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function GridLines({ ticks, format }: { ticks: number[]; format: (t: number) => string }) {
  return (
    <>
      {ticks.map((t) => {
        const y = PAD_TOP + PLOT_HEIGHT * (1 - t)
        return (
          <g key={t}>
            <line
              x1={PAD_LEFT}
              x2={CHART_WIDTH - PAD_RIGHT}
              y1={y}
              y2={y}
              style={{ stroke: 'var(--track)' }}
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              style={{ fill: 'var(--muted-foreground)' }}
              fontSize={10}
            >
              {format(t)}
            </text>
          </g>
        )
      })}
    </>
  )
}

// Generic single-series line trend, driven by any {date, value} series — used
// directly for measurement trends, and wrapped below for weight (which keeps
// its own {date, weightKg} shape so existing callers need no changes).
export function LineTrendChart({
  data,
  unit,
  decimals,
  emptyMessages,
}: {
  data: { date: string; value: number }[]
  unit: string
  decimals?: number
  emptyMessages: { none: string; some: string }
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const chart = useMemo(() => {
    if (data.length < MIN_POINTS_FOR_TREND) return null
    const times = data.map((d) => new Date(d.date).getTime())
    const values = data.map((d) => d.value)
    const minT = Math.min(...times)
    const maxT = Math.max(...times)
    const rawMin = Math.min(...values)
    const rawMax = Math.max(...values)
    const span = Math.max(rawMax - rawMin, 1)
    const minV = rawMin - span * 0.2
    const maxV = rawMax + span * 0.2
    const points = data.map((d, i) => {
      const x =
        PAD_LEFT + (maxT === minT ? PLOT_WIDTH / 2 : ((times[i] - minT) / (maxT - minT)) * PLOT_WIDTH)
      const y = PAD_TOP + PLOT_HEIGHT - ((d.value - minV) / (maxV - minV)) * PLOT_HEIGHT
      return { x, y, date: d.date, value: d.value }
    })
    return { points, minV, maxV }
  }, [data])

  if (!chart) {
    return <EmptyTrendState message={data.length === 0 ? emptyMessages.none : emptyMessages.some} />
  }

  const { points, minV, maxV } = chart
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const hovered = hoverIndex !== null ? points[hoverIndex] : null
  const valueDecimals = decimals ?? (maxV - minV < 5 ? 1 : 0)

  const handleMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH
    let nearest = 0
    let best = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(p.x - px)
      if (d < best) {
        best = d
        nearest = i
      }
    })
    setHoverIndex(nearest)
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <GridLines ticks={[0, 0.5, 1]} format={(t) => (minV + (maxV - minV) * t).toFixed(valueDecimals)} />
        <path
          d={linePath}
          fill="none"
          style={{ stroke: 'var(--ring-remaining)' }}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hovered && (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={PAD_TOP}
            y2={PAD_TOP + PLOT_HEIGHT}
            style={{ stroke: 'var(--border)' }}
            strokeWidth={1}
          />
        )}
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r={hoverIndex === i ? 5 : 3}
            style={{ fill: 'var(--ring-remaining)', stroke: 'var(--card)' }}
            strokeWidth={2}
          />
        ))}
        <rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={PLOT_WIDTH}
          height={PLOT_HEIGHT}
          fill="transparent"
          onMouseMove={handleMove}
        />
        <text x={PAD_LEFT} y={CHART_HEIGHT - 6} textAnchor="start" style={{ fill: 'var(--muted-foreground)' }} fontSize={10}>
          {formatDate(points[0].date)}
        </text>
        <text
          x={CHART_WIDTH - PAD_RIGHT}
          y={CHART_HEIGHT - 6}
          textAnchor="end"
          style={{ fill: 'var(--muted-foreground)' }}
          fontSize={10}
        >
          {formatDate(points[points.length - 1].date)}
        </text>
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute rounded-md border border-border bg-card px-2 py-1 text-xs shadow-md"
          style={{
            left: `${(hovered.x / CHART_WIDTH) * 100}%`,
            top: `${(hovered.y / CHART_HEIGHT) * 100}%`,
            transform: 'translate(-50%, -130%)',
          }}
        >
          <div className="font-medium text-card-foreground">
            {hovered.value} {unit}
          </div>
          <div className="text-muted-foreground">{formatDate(hovered.date)}</div>
        </div>
      )}
    </div>
  )
}

export function WeightTrendChart({ data }: { data: { date: string; weightKg: number }[] }) {
  return (
    <LineTrendChart
      data={data.map((d) => ({ date: d.date, value: d.weightKg }))}
      unit="kg"
      emptyMessages={{
        none: 'Log a weigh-in to start your trend.',
        some: 'Log a few more weigh-ins to see your trend.',
      }}
    />
  )
}

export function CaloriesTrendChart({ data }: { data: { date: string; calories: number }[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const loggedDays = data.filter((d) => d.calories > 0).length
  if (loggedDays < MIN_POINTS_FOR_TREND) {
    return (
      <EmptyTrendState
        message={
          loggedDays === 0
            ? 'Log some food to start your trend.'
            : 'Log a few more days to see your calorie trend.'
        }
      />
    )
  }

  const maxVal = Math.max(...data.map((d) => d.calories), 1)
  const slot = PLOT_WIDTH / data.length
  const barWidth = Math.min(24, slot * 0.6)
  const hovered = hoverIndex !== null ? data[hoverIndex] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full">
        <GridLines ticks={[0, 0.5, 1]} format={(t) => Math.round(maxVal * t).toString()} />
        {data.map((d, i) => {
          const x = PAD_LEFT + slot * i + (slot - barWidth) / 2
          const h = (d.calories / maxVal) * PLOT_HEIGHT
          const y = PAD_TOP + PLOT_HEIGHT - h
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(h, 1)}
              rx={3}
              style={{ fill: 'var(--ring-consumed)', opacity: hoverIndex === i ? 1 : 0.8 }}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          )
        })}
        <text x={PAD_LEFT} y={CHART_HEIGHT - 6} textAnchor="start" style={{ fill: 'var(--muted-foreground)' }} fontSize={10}>
          {formatDate(data[0].date)}
        </text>
        <text
          x={CHART_WIDTH - PAD_RIGHT}
          y={CHART_HEIGHT - 6}
          textAnchor="end"
          style={{ fill: 'var(--muted-foreground)' }}
          fontSize={10}
        >
          {formatDate(data[data.length - 1].date)}
        </text>
      </svg>
      {hovered && hoverIndex !== null && (
        <div
          className="pointer-events-none absolute rounded-md border border-border bg-card px-2 py-1 text-xs shadow-md"
          style={{
            left: `${((PAD_LEFT + slot * hoverIndex + slot / 2) / CHART_WIDTH) * 100}%`,
            top: `${((PAD_TOP + PLOT_HEIGHT - (hovered.calories / maxVal) * PLOT_HEIGHT) / CHART_HEIGHT) * 100}%`,
            transform: 'translate(-50%, -130%)',
          }}
        >
          <div className="font-medium text-card-foreground">{Math.round(hovered.calories)} kcal</div>
          <div className="text-muted-foreground">{formatDate(hovered.date)}</div>
        </div>
      )}
    </div>
  )
}
