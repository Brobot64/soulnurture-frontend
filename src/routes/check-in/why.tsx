import { Link, createFileRoute } from '@tanstack/react-router'

import { StubScreen, stubActionClass } from '#/components/StubScreen'

export const Route = createFileRoute('/check-in/why')({
  component: WhyCheckIn,
})

function WhyCheckIn() {
  return (
    <StubScreen
      step="1 of 3"
      title="Why do you think you feel that way?"
      description="Choose any that fit — school, friends, family, sleep, or something else entirely."
      action={
        <Link to="/reflection/$conversationId" params={{ conversationId: 'preview' }} className={stubActionClass}>
          Next
        </Link>
      }
    />
  )
}
