import type { ReactNode } from "react";

/**
 * An iPad, drawn rather than photographed.
 *
 * A stock device PNG is the fastest way to make a product site look like a
 * template, and it can't be recoloured, can't scale crisply, and weighs more
 * than this entire page. This is a rounded rectangle with a bezel and two
 * highlights — which is, in fairness, what an iPad looks like.
 *
 * The aspect ratio is the real one the app renders at: 2388 × 1668 (iPad Pro
 * 11"), so a screenshot dropped inside is not distorted.
 */

interface IPadProps {
  orientation?: "landscape" | "portrait";
  children: ReactNode;
  className?: string;
  /** Screen content bleeds to the bezel edge; set false for a letterboxed shot. */
  bleed?: boolean;
}

const ASPECT = { landscape: "2388 / 1668", portrait: "1668 / 2388" } as const;

export function IPad({ orientation = "landscape", children, className = "", bleed = true }: IPadProps) {
  return (
    <div
      className={`relative isolate ${className}`}
      style={{ aspectRatio: ASPECT[orientation] }}
      aria-hidden="true"
    >
      {/* Bezel. The dark surround is the app's own near-black surface value
          rather than #000, so it sits on cream paper without punching a hole. */}
      <div
        className="absolute inset-0 rounded-[var(--radius-device)] bg-[#0D0E11] p-[1.6%] shadow-[var(--shadow-device)]"
        style={{
          // A hairline of lighter metal along the top edge, the way an
          // anodised chamfer catches the light. One gradient, not a stack.
          backgroundImage:
            "linear-gradient(to bottom, rgb(255 255 255 / 0.14), rgb(255 255 255 / 0) 3%, rgb(255 255 255 / 0) 97%, rgb(255 255 255 / 0.06))",
        }}
      >
        <div
          className={`h-full w-full overflow-hidden rounded-[calc(var(--radius-device)-0.55rem)] bg-[var(--color-surface)] ${
            bleed ? "" : "p-2"
          }`}
        >
          {children}
        </div>
      </div>

      {/* A single soft sheen across the glass. Kept very low — a glossy
          reflection reads as a stock mockup, and the point is the page
          underneath, not the device. */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[var(--radius-device)] opacity-[0.055]"
        style={{
          backgroundImage:
            "linear-gradient(105deg, transparent 30%, white 44%, white 47%, transparent 60%)",
        }}
      />
    </div>
  );
}
