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

/** An asterisk sparkle, the kind drawn next to something that matters. */
export function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg className={`hp-doodle ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path {...common} strokeWidth="1.8" d="M12 3.5 L12.4 20.5" />
      <path {...common} strokeWidth="1.8" d="M3.5 11.6 L20.5 12.4" />
      <path {...common} strokeWidth="1.8" d="M6.2 6.4 L17.6 17.4" />
      <path {...common} strokeWidth="1.8" d="M17.8 6.2 L6.4 17.6" />
    </svg>
  );
}

/** Three short lines bursting off a score that went up. */
export function Burst({ className = "" }: { className?: string }) {
  return (
    <svg className={`hp-doodle ${className}`} viewBox="0 0 48 40" aria-hidden="true">
      <path {...common} strokeWidth="3" d="M8 33 L2 25" />
      <path {...common} strokeWidth="3" d="M21 22 L19 6" />
      <path {...common} strokeWidth="3" d="M33 27 L45 16" />
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

/** A curved arrow with its head, pointing right then down. */
export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg className={`hp-doodle ${className}`} viewBox="0 0 120 80" aria-hidden="true">
      <path {...common} strokeWidth="2.6" d="M6 10 C 46 4, 92 18, 104 62" />
      <path {...common} strokeWidth="2.6" d="M92 52 L104 64 L112 48" />
    </svg>
  );
}

/** A looping arrow, the doodle that says "this one". */
export function LoopArrow({ className = "" }: { className?: string }) {
  return (
    <svg className={`hp-doodle ${className}`} viewBox="0 0 140 100" aria-hidden="true">
      <path {...common} strokeWidth="2.6" d="M8 10 C 30 40, 14 72, 46 72 C 76 72, 70 42, 58 50 C 46 58, 82 92, 124 82" />
      <path {...common} strokeWidth="2.6" d="M110 72 L125 82 L112 93" />
    </svg>
  );
}

/** A short arrow curving back to the left, for a note written beside something. */
export function ArrowBack({ className = "" }: { className?: string }) {
  return (
    <svg className={`hp-doodle ${className}`} viewBox="0 0 110 50" aria-hidden="true">
      <path {...common} strokeWidth="2.6" d="M104 14 C 78 40, 42 42, 10 30" />
      <path {...common} strokeWidth="2.6" d="M22 19 L9 30 L24 39" />
    </svg>
  );
}
