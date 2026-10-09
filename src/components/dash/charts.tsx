// Hand-rolled inline-SVG charts — no chart library. Colors ride the chart-*
// tokens from styles.css.

import { Star } from 'lucide-react'

/** Mirror of the backend MoodId roll-up — order is the donut legend order. */
export const MOOD_IDS = [
  'GREAT',
  'NORMAL',
  'SAD',
  'ANGRY',
  'CONFUSED',
  'INDIFFERENT',
  'STRANGE',
  'DISTRAUGHT',
] as const
export type MoodId = (typeof MOOD_IDS)[number]

export const MOOD_LABELS: Record<MoodId, string> = {
  GREAT: 'Great',
  NORMAL: 'Normal',
  SAD: 'Sad',
  ANGRY: 'Angry',
  CONFUSED: 'Confused',
  INDIFFERENT: 'Indifferent',
  STRANGE: 'Strange',
  DISTRAUGHT: 'Distraught',
}

const MOOD_COLORS: Record<MoodId, string> = {
  GREAT: 'var(--color-chart-great)',
  NORMAL: 'var(--color-chart-normal)',
  SAD: 'var(--color-chart-sad)',
  ANGRY: 'var(--color-chart-angry)',
  CONFUSED: 'var(--color-chart-confused)',
  INDIFFERENT: 'var(--color-chart-indifferent)',
  STRANGE: 'var(--color-chart-strange)',
  DISTRAUGHT: 'var(--color-chart-distraught)',
}

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

export function Sparkline({
  values,
  className = 'text-brand-4',
}: {
  values: number[]
  className?: string
}) {
  const width = 100
  const height = 32
  const max = Math.max(...values, 1)
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values
    .map((value, index) => {
      const x = index * step
      const y = height - 3 - (value / max) * (height - 6)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`h-8 w-full ${className}`}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

interface DonutStatProps {
  distribution: Record<MoodId, number>
  label?: string
}

/** Eight-segment donut with a legend; 12px strokes, rounded caps, small gaps. */
export function DonutStat({ distribution, label = 'check-ins' }: DonutStatProps) {
  const total = MOOD_IDS.reduce((sum, mood) => sum + (distribution[mood] ?? 0), 0)
  const size = 160
  const center = size / 2
  const radius = 62
  const stroke = 12
  const circumference = 2 * Math.PI * radius
  const slices = MOOD_IDS.map((mood) => ({ mood, value: distribution[mood] ?? 0 })).filter(
    (slice) => slice.value > 0,
  )
  const gap = slices.length > 1 ? 3 : 0

  let offset = 0
  const segments = slices.map((slice) => {
    const length = Math.max((slice.value / total) * circumference - gap, 1)
    const segment = { mood: slice.mood, length, offset }
    offset += (slice.value / total) * circumference
    return segment
  })

  return (
    <div className="flex flex-wrap items-center gap-7">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-40 shrink-0"
        role="img"
        aria-label={`Mood distribution across ${total} ${label}`}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-panel-2)"
          strokeWidth={stroke}
        />
        <g transform={`rotate(-90 ${center} ${center})`}>
          {segments.map((segment) => (
            <circle
              key={segment.mood}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              style={{ stroke: MOOD_COLORS[segment.mood] }}
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
            />
          ))}
        </g>
        <text
          x={center}
          y={center - 2}
          textAnchor="middle"
          className="fill-heading text-[28px] font-bold"
          style={{ fontWeight: 700 }}
        >
          {total}
        </text>
        <text
          x={center}
          y={center + 16}
          textAnchor="middle"
          className="fill-muted text-[11px]"
        >
          {label}
        </text>
      </svg>

      <ul className="grid min-w-44 flex-1 grid-cols-2 gap-x-6 gap-y-1.5">
        {MOOD_IDS.map((mood) => {
          const value = distribution[mood] ?? 0
          const pct = total > 0 ? Math.round((value / total) * 100) : 0
          return (
            <li key={mood} className="flex items-center gap-2 text-bubble text-body">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: MOOD_COLORS[mood] }}
              />
              <span className="flex-1 truncate">{MOOD_LABELS[mood]}</span>
              <span className="tabular-nums text-muted">{pct}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Seven weekday bars; the busiest day wears accent + a star. */
export function Bars7({ weekday }: { weekday: { weekday: string; count: number }[] }) {
  const byDay = new Map(weekday.map((row) => [row.weekday, row.count]))
  const rows = WEEKDAYS.map((day) => ({ day, count: byDay.get(day) ?? 0 }))
  const max = Math.max(...rows.map((row) => row.count), 0)
  const maxHeight = 132

  return (
    <div className="flex items-end justify-between gap-2">
      {rows.map((row) => {
        const isMax = max > 0 && row.count === max
        const height = max > 0 && row.count > 0 ? Math.max((row.count / max) * maxHeight, 8) : 4
        return (
          <div key={row.day} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-meta text-muted tabular-nums">{row.count > 0 ? row.count : ''}</span>
            <div className="relative flex w-full justify-center" style={{ height: maxHeight }}>
              <div
                className={`absolute bottom-0 w-full max-w-9 rounded-t-lg ${
                  isMax ? 'bg-accent' : row.count > 0 ? 'bg-brand-4' : 'bg-panel-2'
                }`}
                style={{ height }}
              />
              {isMax && (
                <Star
                  aria-hidden="true"
                  className="absolute -top-1 size-3.5 fill-accent text-accent"
                  style={{ top: Math.max(maxHeight - height - 18, 0) }}
                />
              )}
            </div>
            <span className="text-caption text-muted">{row.day}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ProgressBar({
  value,
  className = '',
}: {
  value: number
  className?: string
}) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className={`h-2.5 w-full overflow-hidden rounded-pill bg-panel-2 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-pill bg-brand-4 transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
