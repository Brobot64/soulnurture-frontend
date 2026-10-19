import { useEffect, useState } from 'react'

import { Spinner } from '#/components/StatusBadge'
import { ApiError } from '#/lib/api'
import {
  MOODS,
  fetchCheckInFeedback,
  submitCheckInFeedback,
  type CheckInFeedback,
  type MoodOption,
} from '#/lib/journey'

type Phase = 'loading' | 'ask' | 'saving' | 'done'

/// "How are you feel­ing now?" — asked once per check-in on the completion
/// screen. One tap submits; the answer feeds the platform-admin mood-effect
/// report and never touches the student profile.
export function MoodFeedback({ checkInId }: { checkInId: string }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [picked, setPicked] = useState<MoodOption | null>(null)
  const [existing, setExisting] = useState<CheckInFeedback | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchCheckInFeedback(checkInId)
      .then((feedback) => {
        if (cancelled) return
        if (feedback) {
          setExisting(feedback)
          setPhase('done')
        } else {
          setPhase('ask')
        }
      })
      .catch(() => {
        if (!cancelled) setPhase('ask')
      })
    return () => {
      cancelled = true
    }
  }, [checkInId])

  const pick = async (mood: MoodOption) => {
    if (phase !== 'ask') return
    setPhase('saving')
    setPicked(mood)
    try {
      await submitCheckInFeedback(checkInId, {
        feeling: mood.feeling,
        intensity: mood.intensity,
      })
      setPhase('done')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        // Answered already (refresh / double tap) — treat as done.
        setPhase('done')
        return
      }
      setPhase('ask')
      setPicked(null)
      setFailed(true)
    }
  }

  const doneMood = existing
    ? MOODS.find((mood) => mood.feeling === existing.feeling)
    : picked

  return (
    <section className="mt-10" aria-label="How are you feeling now?">
      <div className="border-t border-hairline pt-8">
        {phase === 'loading' ? null : phase === 'done' ? (
          <p className="text-copy text-body">
            <span aria-hidden="true">{doneMood?.emoji ?? '🙂'} </span>
            Thanks — knowing how you feel after a check-in helps us learn what
            actually helps.
          </p>
        ) : (
          <>
            <h2 className="text-section text-heading">And how are you feeling now?</h2>
            <p className="mt-2 text-copy text-body">
              One last tap — your answer stays private and helps us see what
              works.
            </p>
            <div
              role="radiogroup"
              aria-label="How are you feeling now?"
              className="mt-5 grid grid-cols-4 gap-2.5"
            >
              {MOODS.map((mood) => {
                const active = picked?.id === mood.id
                return (
                  <button
                    key={mood.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={phase === 'saving'}
                    onClick={() => void pick(mood)}
                    className={`flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-2xl border-2 ${mood.tone} ${
                      active ? 'border-action' : 'border-black/[0.04] hover:border-action/25'
                    } disabled:opacity-60`}
                  >
                    {phase === 'saving' && active ? (
                      <Spinner />
                    ) : (
                      <span className="text-[26px] leading-none lg:text-[30px]">
                        {mood.emoji}
                      </span>
                    )}
                    <span className="text-bubble font-bold text-ink lg:text-card">
                      {mood.label}
                    </span>
                  </button>
                )
              })}
            </div>
            {failed && (
              <p className="mt-3 text-copy-sm text-counsellor">
                That didn't save — tap a face to try again.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
