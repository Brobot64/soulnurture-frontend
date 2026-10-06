import { Link, createFileRoute } from '@tanstack/react-router'

import { StubScreen, stubActionClass } from '#/components/StubScreen'

export const Route = createFileRoute('/complete/$checkInId')({
  component: CheckInComplete,
})

function CheckInComplete() {
  return (
    <StubScreen
      step="3 of 3"
      title="Thanks for checking in"
      description="Your feelings and topics, saved to your wellbeing history — with resources and a real person one tap away."
      action={
        <Link to="/welcome" className={stubActionClass}>
          I'm done for now
        </Link>
      }
    />
  )
}
