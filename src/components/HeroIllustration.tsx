export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-200 -200 400 400"
      fill="none"
      role="img"
      aria-label="A smiling face inside soft green circles"
      className={className}
    >
      <circle r="142.5" style={{ fill: 'var(--color-surface)' }} />
      <circle r="108" style={{ fill: 'var(--color-mint)' }} fillOpacity="0.55" />
      <circle r="72" style={{ fill: 'var(--color-action)' }} />
      <circle cx="-12" cy="-20" r="7" style={{ fill: 'var(--color-page)' }} />
      <circle cx="26" cy="-20" r="7" style={{ fill: 'var(--color-page)' }} />
      <path
        d="M -11 6 Q 10 16 31 6"
        strokeWidth="4.5"
        strokeLinecap="round"
        style={{ stroke: 'var(--color-page)' }}
      />
      <circle cx="135.5" cy="-85.5" r="19.5" style={{ fill: 'var(--color-accent)' }} />
      <circle cx="-142" cy="87" r="12" style={{ fill: 'var(--color-mint)' }} />
      <circle cx="173" cy="66" r="9" style={{ fill: 'var(--color-blush)' }} />
    </svg>
  )
}
