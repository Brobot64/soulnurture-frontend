import { Link, createFileRoute } from '@tanstack/react-router'

import { StubScreen, stubActionClass } from '#/components/StubScreen'

export const Route = createFileRoute('/reflection/$conversationId')({
  component: Reflection,
})

function Reflection() {
  return (
    <StubScreen
      step="2 of 3"
      title="Guided reflection"
      description="A calm, bounded conversation about what you shared — quick replies, no pressure, and a clear route to a real person."
      action={
        <Link to="/complete/$checkInId" params={{ checkInId: 'preview' }} className={stubActionClass}>
          Continue
        </Link>
      }
    />
  )
}
