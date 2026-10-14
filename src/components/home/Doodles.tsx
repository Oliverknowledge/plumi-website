/**
 * Pencil doodles: the margins of a revision notebook. Each is one or two hand-drawn
 * strokes (pathLength 1, so CSS can draw them in with stroke-dashoffset) and is
 * decorative only. The parent's `.is-in` (from data-reveal), or the hero's own
 * load animation, draws them. Under reduced motion they are simply there.
 */
const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1 };

/** A quick underline swash, as if a pencil underlined the words. */
export function Underline({ className = "" }: { className?: string }) {
  return (
    <svg className={`hp-doodle ${className}`} viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true">
      <path {...common} strokeWidth="6" d="M8 27 C 120 11, 262 7, 380 15 S 548 29, 592 12" />
    </svg>
  );
}



/** A loose pencil ring, as if circled in the margin. */
export function Ring({ className = "" }: { className?: string }) {
  return (
    <svg className={`hp-doodle ${className}`} viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
      <path {...common} strokeWidth="2.6" d="M22 12 C 70 2, 170 4, 190 24 C 204 42, 120 58, 56 54 C 12 51, 2 34, 14 22 C 24 12, 52 8, 80 9" />
    </svg>
  );
}



