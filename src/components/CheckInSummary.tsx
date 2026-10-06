import { getMoodByFeeling, type CheckIn } from '#/lib/journey'

interface CheckInSummaryProps {
  checkIn: CheckIn
  circle?: boolean
  className?: string
}

export function CheckInSummary({ checkIn, circle = false, className = '' }: CheckInSummaryProps) {
  const mood = getMoodByFeeling(checkIn.feeling)

  return (
    <div className={className}>
      <div className="flex items-center">
        {circle ? (
          <span
            className={`grid size-[72px] shrink-0 place-items-center rounded-full ${mood?.tone ?? 'bg-panel'}`}
          >
            <span className="text-[34px] leading-none">{mood?.emoji ?? '🙂'}</span>
          </span>
        ) : (
          <span className="text-[40px] leading-none">{mood?.emoji ?? '🙂'}</span>
        )}
        <div className={circle ? 'ml-5' : 'ml-4'}>
          <p className="text-copy-sm text-muted">Feeling</p>
          <p className="text-button font-bold text-heading">{mood?.label ?? checkIn.feeling}</p>
        </div>
      </div>
      <div className="mt-6 border-t border-hairline" />
      {checkIn.triggers.length > 0 && (
        <>
          <p className="mt-5 text-copy-sm text-muted">On your mind</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {checkIn.triggers.map((trigger) => (
              <span
                key={trigger}
                className="inline-flex h-9 items-center rounded-pill bg-panel px-4 text-chip text-brand-4"
              >
                {trigger}
              </span>
            ))}
          </div>
        </>
      )}
      <p className="mt-5 text-copy-sm text-muted">Saved to your wellbeing history</p>
    </div>
  )
}
