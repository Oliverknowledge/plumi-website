import { strokePath } from "@/lib/hand";
import { cross, half, tick, type Rect } from "@/lib/hand/marks";

/**
 * One of Plumi's marks, drawn with the pen's own geometry.
 *
 * The app draws every row of its paywall list, and every verdict on a marked
 * page, with these strokes rather than with a symbol from a system icon set.
 * A tick from SF Symbols would be a different product's tick, and a student who
 * has seen the app would notice. So the website uses the same three shapes.
 *
 * Pure geometry and no browser globals, so this renders in a Server Component
 * as finished path data.
 */

const makers = { tick, half, cross } as const;

export type MarkName = keyof typeof makers;

interface HandMarkProps {
  mark: MarkName;
  /** Box the mark is drawn into, in px. The tail of a tick overshoots it slightly. */
  size?: number;
  /** A design token, e.g. `var(--color-correct)`. */
  colour: string;
  /** Given to a screen reader. Omit where the mark is captioned in text nearby. */
  label?: string;
  className?: string;
}

export function HandMark({ mark, size = 20, colour, label, className = "" }: HandMarkProps) {
  // The pen's own constants are authored against ~16px text; a mark drawn
  // larger than that wants a proportionally wider nib or it reads as a hairline.
  const strokeWidth = Math.max(1.9, size * 0.125);
  const pad = size * 0.14;
  const rect: Rect = { x: pad, y: pad, width: size - pad * 2, height: size - pad * 2 };
  const strokes = makers[mark](rect, { strokeWidth });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 ${className}`}
      style={{ color: colour }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {strokes.map((stroke, i) => (
        <path
          key={i}
          d={strokePath(stroke)}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
