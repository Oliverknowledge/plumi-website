/**
 * The mastery indicator: four small bars, filled as far as the evidence goes.
 *
 * Lifted directly off the app's Progress screen. It is four bars rather than a
 * ring, a percentage or a score for a reason that runs through the whole
 * product: Plumi has no confidence numbers anywhere. Its third design principle
 * is "say uncertainty in words, or not at all", and a 73% next to a topic is a
 * precision nobody has earned.
 *
 * Decorative — the band is always named in words beside it, so a screen reader
 * gets the fact rather than a description of four rectangles.
 */
export function BandBars({
  filled,
  colour,
  size = "default",
}: {
  /** 0–4. */
  filled: number;
  colour: string;
  size?: "default" | "small";
}) {
  const w = size === "small" ? 9 : 12;
  const h = size === "small" ? 3.5 : 5;
  const gap = size === "small" ? 4 : 5;

  return (
    <span className="inline-flex shrink-0 items-center" style={{ gap }} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            width: w,
            height: h,
            borderRadius: h / 2,
            backgroundColor: i < filled ? colour : "var(--color-mastery-unseen)",
          }}
        />
      ))}
    </span>
  );
}
