import { useMemo, useState, type MouseEvent } from 'react'

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

export function WeightTrendChart({ data }: { data: { date: string; weightKg: number }[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const chart = useMemo(() => {
    if (data.length === 0) return null
    const times = data.map((d) => new Date(d.date).getTime())
    const weights = data.map((d) => d.weightKg)
    const minT = Math.min(...times)
    const maxT = Math.max(...times)
    const rawMin = Math.min(...weights)
    const rawMax = Math.max(...weights)
    const span = Math.max(rawMax - rawMin, 1)
    const minW = rawMin - span * 0.2
    const maxW = rawMax + span * 0.2
    const points = data.map((d, i) => {
      const x =
        PAD_LEFT + (maxT === minT ? PLOT_WIDTH / 2 : ((times[i] - minT) / (maxT - minT)) * PLOT_WIDTH)
      const y = PAD_TOP + PLOT_HEIGHT - ((d.weightKg - minW) / (maxW - minW)) * PLOT_HEIGHT
      return { x, y, date: d.date, weightKg: d.weightKg }
    })
    return { points, minW, maxW }
  }, [data])

  if (!chart) {
    return <p className="text-sm text-muted-foreground">No weight logged yet.</p>
  }

  const { points, minW, maxW } = chart
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const hovered = hoverIndex !== null ? points[hoverIndex] : null

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
        <GridLines
          ticks={[0, 0.5, 1]}
          format={(t) => {
            const span = maxW - minW
            const decimals = span < 5 ? 1 : 0
            return (minW + span * t).toFixed(decimals)
          }}
        />
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
          <div className="font-medium text-card-foreground">{hovered.weightKg} kg</div>
          <div className="text-muted-foreground">{formatDate(hovered.date)}</div>
        </div>
      )}
    </div>
  )
}

export function CaloriesTrendChart({ data }: { data: { date: string; calories: number }[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>
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
