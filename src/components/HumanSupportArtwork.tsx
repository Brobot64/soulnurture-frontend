import artUrl from '#/assets/soul-nurture-human-support.png'

export function HumanSupportArtwork({ className }: { className?: string }) {
  return (
    <img
      src={artUrl}
      alt="Two young people sitting side by side on a lavender sofa, seen from behind — one holding a phone, the other a card. A speech bubble with a heart floats above them, a sprout-shaped balloon trails past, a purple shield with a white tick promises safety, and a plant stands at each end."
      width={1600}
      height={1000}
      className={className}
    />
  )
}
