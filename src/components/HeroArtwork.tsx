import heroUrl from '#/assets/soul-nurture-hero.png'

export function HeroArtwork({ className }: { className?: string }) {
  return (
    <img
      src={heroUrl}
      alt="A speech bubble with a young sprout growing inside it, floating over a green field in a soft pastel sky."
      width={534}
      height={534}
      className={className}
    />
  )
}
