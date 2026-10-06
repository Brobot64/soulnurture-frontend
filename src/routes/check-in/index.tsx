import { Link, createFileRoute } from '@tanstack/react-router'

import { StubScreen, stubActionClass } from '#/components/StubScreen'

export const Route = createFileRoute('/check-in/')({
  component: MoodCheckIn,
})

function MoodCheckIn() {
  return (
    <StubScreen
      step="1 of 3"
      title="How are you feeling right now?"
      description="Eight faces, one optional note — tap the one that feels closest. You can change it any time."
      action={
        <Link to="/check-in/why" className={stubActionClass}>
          Continue
        </Link>
      }
    />
  )
}
