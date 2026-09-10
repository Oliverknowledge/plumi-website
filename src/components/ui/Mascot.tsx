import Image from "next/image";

/**
 * Plumi — the mascot, which shares its name with the app.
 *
 * A blue-and-white origami paper bird. This is the founder's delivered
 * artwork, the same ten 768px PNGs the iPad app ships (converted to WebP here,
 * which takes the set from 3.4 MB to 390 kB).
 *
 * ── Why this is not one <img> ────────────────────────────────────────────────
 * The poses are generated illustrations, not a rig. They are not registered
 * with each other: each one sits differently on its canvas, so swapping the
 * `src` makes the bird jump. Every pose therefore carries the alpha bounds
 * measured for the app (`Mascot.swift:230-243`, from the kit's manifest.json),
 * and is scaled and offset so the visible artwork occupies the same box in
 * every pose — feet on the same line, head on the same line, centred on the
 * same axis. That normalisation is the entire reason this is a component.
 *
 * ── What it honestly cannot do ───────────────────────────────────────────────
 * The eyes cannot blink and the wings cannot grip. There is no interpolation
 * between poses. The idle life is a restrained float — about three pixels of
 * drift and a degree of roll — which is what a paper object resting in the air
 * actually does. Anything more would be a lie about the asset.
 */

/** Bounds were measured on a 1254px master; normalising keeps them valid at 768. */
const CANVAS = 1254;

function bounds(x0: number, y0: number, x1: number, y1: number) {
  return {
    x: x0 / CANVAS,
    y: y0 / CANVAS,
    w: (x1 - x0) / CANVAS,
    h: (y1 - y0) / CANVAS,
  };
}

export type MascotPose =
  /** Neutral companion. The default everywhere. */
  | "idle"
  /** Greeting. First screen only — a greeting that recurs is not a greeting. */
  | "welcoming"
  /** Working on it. An answer actually in flight, never a decorative spinner. */
  | "thinking"
  /** Plumi is saying something about the work. */
  | "explaining"
  /** Active study. Determined, and therefore never shown after a mistake. */
  | "focused"
  /** Warm. The right face after a wrong answer. */
  | "encouraging"
  /** A useful connection has been noticed. */
  | "curious"
  /** Something finished. Completion, not applause for pressing Continue. */
  | "celebrating"
  /** Quiet idle. */
  | "sleeping";

const poses: Record<MascotPose, { asset: string; box: ReturnType<typeof bounds>; alt: string }> = {
  idle: { asset: "plumi-default", box: bounds(151, 88, 1120, 1181), alt: "Plumi, an origami paper bird" },
  welcoming: { asset: "plumi-welcoming", box: bounds(129, 77, 1107, 1186), alt: "Plumi, waving" },
  thinking: { asset: "plumi-thinking", box: bounds(148, 80, 1092, 1185), alt: "Plumi, thinking" },
  explaining: { asset: "plumi-explaining", box: bounds(138, 80, 1160, 1185), alt: "Plumi, explaining something" },
  focused: { asset: "plumi-focused", box: bounds(148, 85, 1120, 1182), alt: "Plumi, concentrating" },
  encouraging: { asset: "plumi-encouraging", box: bounds(149, 82, 1173, 1180), alt: "Plumi, encouraging" },
  curious: { asset: "plumi-insight", box: bounds(150, 71, 1156, 1184), alt: "Plumi, having noticed something" },
  celebrating: { asset: "plumi-celebrating", box: bounds(146, 86, 1138, 1182), alt: "Plumi, celebrating" },
  sleeping: { asset: "plumi-resting", box: bounds(150, 87, 946, 1183), alt: "Plumi, asleep" },
};

/** The artwork fills 96% of the frame's height, as in the app. */
const FILL = 0.96;

interface MascotProps {
  pose?: MascotPose;
  /** Rendered size in px. The frame is always square. */
  size?: number;
  /**
   * Decorative by default, exactly as in the app. Pass a description only where
   * the bird carries meaning a screen reader would otherwise miss.
   */
  alt?: string;
  /** Idle float. Off for anything small enough that three pixels would read as a wobble. */
  animated?: boolean;
  priority?: boolean;
  className?: string;
}

export function Mascot({
  pose = "idle",
  size = 160,
  alt,
  animated = true,
  priority = false,
  className = "",
}: MascotProps) {
  const { asset, box } = poses[pose];

  // Scale so the *visible* height is FILL of the frame, then place the visible
  // box's midpoint at the frame's midpoint.
  const width = (FILL / box.h) * 100;
  const left = 50 - (box.x + box.w / 2) * (FILL / box.h) * 100;
  const top = 50 - (box.y + box.h / 2) * (FILL / box.h) * 100;

  const decorative = alt === undefined;

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": alt })}
    >
      {/* Two nested elements so the drift and the roll run on separate,
          deliberately non-harmonic periods (4.7s and 7.9s) and never
          phase-lock into a single mechanical bob. */}
      <div
        className={animated ? "h-full w-full [animation:plumi-drift_4.7s_ease-in-out_infinite]" : "h-full w-full"}
        // The app's amplitude: min(3, size × 0.018) points. A fixed 3px would
        // read as a wobble on a 48px bird.
        style={{ "--plumi-drift": `${Math.min(3, size * 0.018)}px` } as React.CSSProperties}
      >
        <div
          className={
            animated
              ? "h-full w-full origin-bottom [animation:plumi-roll_7.9s_ease-in-out_infinite]"
              : "h-full w-full"
          }
        >
          <Image
            src={`/mascot/${asset}.webp`}
            alt=""
            width={768}
            height={768}
            priority={priority}
            sizes={`${size}px`}
            className="absolute max-w-none select-none"
            style={{
              width: `${width}%`,
              height: "auto",
              left: `${left}%`,
              top: `${top}%`,
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
