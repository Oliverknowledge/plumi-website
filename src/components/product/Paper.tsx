import type { ReactNode } from "react";

import { PAGE } from "./paperGeometry";

/**
 * Plumi's notebook paper.
 *
 * The measurements are the app's, from `Features/Notebook/PaperBackground.swift`,
 * which took them from real exam stationery: a 36pt rule pitch, an 88pt top
 * margin, rules inset 64pt from the left and 48pt from the right, and a
 * vertical margin rule at x = 96. The margin rule is #D98A8A at 45% — "the
 * red-ish margin rule that makes a page read as school stationery rather than
 * as a text field."
 *
 * `PaperSurface` is the drawing, as an SVG group, so a larger scene can compose
 * the page into its own coordinate space. `Paper` is the same thing wrapped in
 * a card, for the many places that just want a page on its own.
 *
 * One shadow, not three. Stacked shadows are the fastest way to make a page
 * look like a web card.
 */

// Re-exported so callers can import the page and its geometry from one place.
export { PAGE, ruleAt, inkTopForRule } from "./paperGeometry";

export type PaperTemplate = "ruled" | "grid" | "dotted" | "blank";

interface SurfaceProps {
  x?: number;
  y?: number;
  width: number;
  height: number;
  template?: PaperTemplate;
  /** Page fill. Cream by default — the app's `paper`, never #FFFFFF. */
  fill?: string;
  radius?: number;
}

export function PaperSurface({
  x = 0,
  y = 0,
  width,
  height,
  template = "ruled",
  fill = "var(--color-paper)",
  radius = 3,
}: SurfaceProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height={height} rx={radius} fill={fill} />
      {template === "ruled" && <Rules width={width} height={height} />}
      {template === "grid" && <Grid width={width} height={height} pitch={28} />}
      {template === "dotted" && <Dots width={width} height={height} pitch={26} />}
    </g>
  );
}

interface PaperProps extends Omit<SurfaceProps, "x" | "y"> {
  children?: ReactNode;
  className?: string;
}

export function Paper({ width, height, template = "ruled", children, className = "" }: PaperProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[3px] shadow-[var(--shadow-resting)] ring-1 ring-[var(--color-hairline)] ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <PaperSurface width={width} height={height} template={template} radius={0} />
        {children}
      </svg>
    </div>
  );
}

function Rules({ width, height }: { width: number; height: number }) {
  const lines: number[] = [];
  for (let y = PAGE.topMargin; y < height - 8; y += PAGE.rule) lines.push(y);

  return (
    <>
      {lines.map((y) => (
        <line
          key={y}
          x1={PAGE.insetLeft}
          y1={y}
          x2={width - PAGE.insetRight}
          y2={y}
          stroke={PAGE.ruleColour}
          strokeWidth={1}
        />
      ))}
      {/* Not decoration: the single detail that makes a blank rectangle read as
          school stationery rather than as a text field. */}
      <line
        x1={PAGE.marginRuleX}
        y1={0}
        x2={PAGE.marginRuleX}
        y2={height}
        stroke={PAGE.marginColour}
        strokeOpacity={0.45}
        strokeWidth={1}
      />
    </>
  );
}

function Grid({ width, height, pitch }: { width: number; height: number; pitch: number }) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = pitch; x < width; x += pitch) xs.push(x);
  for (let y = pitch; y < height; y += pitch) ys.push(y);

  return (
    <g stroke={PAGE.ruleColour} strokeWidth={0.6}>
      {xs.map((x) => (
        <line key={`x${x}`} x1={x} y1={0} x2={x} y2={height} />
      ))}
      {ys.map((y) => (
        <line key={`y${y}`} x1={0} y1={y} x2={width} y2={y} />
      ))}
    </g>
  );
}

function Dots({ width, height, pitch }: { width: number; height: number; pitch: number }) {
  const dots: Array<[number, number]> = [];
  for (let x = pitch; x < width; x += pitch) {
    for (let y = pitch; y < height; y += pitch) dots.push([x, y]);
  }

  return (
    <g fill={PAGE.ruleColour}>
      {dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1} />
      ))}
    </g>
  );
}
