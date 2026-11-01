import type { CSSProperties } from "react";

/**
 * Pixel icons, drawn on an 8 x 8 grid and shown with crisp edges, as the app draws them.
 *
 * Draw an icon as eight strings of eight characters: `#` is a filled square, anything else is
 * empty. Whole-number multiples of 8 (16, 24, 32) stay sharp; other sizes blur the edges.
 *
 * The flame and remove icons are the lofi artifact's own paths (style-spec.md section 5) and
 * are kept verbatim. The rest are drawn here in the same idiom (the artifact's own magnifier
 * reads as a "Q" at 16px, so search is redrawn), and need an eye from whoever owns the app's
 * icon set before they are called final.
 *
 * Icons take their colour from `currentColor`, so they follow the text they sit in; the flame
 * is the one two-tone icon and carries its own colours.
 */

type Grid = readonly [string, string, string, string, string, string, string, string];

const grids = {
  plus: [
    "...##...", "...##...", "...##...", "########", "########", "...##...", "...##...", "...##...",
  ],
  check: [
    "........", "......##", ".....###", "##..###.", "###.##..", ".####...", "..###...", "...#....",
  ],
  chevronDown: [
    "........", "........", "##....##", "###..###", ".######.", "..####..", "...##...", "........",
  ],
  chevronRight: [
    "..##....", "..###...", "...###..", "....###.", "....###.", "...###..", "..###...", "..##....",
  ],
  arrowRight: [
    "........", "....#...", "....##..", "#######.", "#######.", "....##..", "....#...", "........",
  ],
  clock: [
    "..####..", ".#....#.", "#..#...#", "#..#...#", "#..###.#", "#......#", ".#....#.", "..####..",
  ],
  book: [
    ".#######", "##.....#", "#.####.#", "#......#", "#.####.#", "#......#", "##.....#", ".#######",
  ],
  pencil: [
    "......##", ".....###", "....###.", "...###..", "..###...", ".###....", ".##.....", "#.......",
  ],
  lock: [
    "..####..", ".##..##.", ".#....#.", "########", "########", "###..###", "###..###", "########",
  ],
  star: [
    "...##...", "...##...", "########", ".######.", "..####..", ".######.", ".##..##.", ".#....#.",
  ],
  sun: [
    "...##...", ".#....#.", "..####..", "#.####.#", "#.####.#", "..####..", ".#....#.", "...##...",
  ],
  search: [
    "..####..", ".#....#.", ".#....#.", ".#....#.", "..####..", "....###.", ".....###", "......##",
  ],
  moon: [
    "..####..", ".##.....", "##......", "##......", "##.....#", ".##...##", "..######", "...####.",
  ],
  home: [
    "...##...", "..####..", ".######.", "########", ".######.", ".##..##.", ".##..##.", ".##..##.",
  ],
  gamepad: [
    "........", ".######.", "##.##.##", "#.#.##.#", "##.#..##", "########", "##....##", "........",
  ],
  shirt: [
    "##....##", "########", "########", ".######.", ".######.", ".######.", ".######.", "........",
  ],
  chart: [
    "........", "......##", "......##", "...##.##", "...##.##", "##.##.##", "##.##.##", "########",
  ],
  gear: [
    "...##...", ".######.", ".##..##.", "###..###", "###..###", ".##..##.", ".######.", "...##...",
  ],
  user: [
    "..####..", ".######.", ".######.", "..####..", "...##...", ".######.", "########", "########",
  ],
} as const satisfies Record<string, Grid>;

/** Verbatim from the lofi artifact: filled paths on the same 8 x 8 grid. */
const raw = {
  close: [{ d: "M0 0h2v1h1v1h2V1h1V0h2v2H7v1H6v2h1v1h1v2H6V7H5V6H3v1H2v1H0V6h1V5h1V3H1V2H0z" }],
  flame: [
    { d: "M3 0h1v1h1v1h1v1h1v4H6v1H2V7H1V3h1V2h1z", fill: "var(--st-flame)" },
    { d: "M3 4h1v1h1V4h1v3H2V5h1z", fill: "var(--st-yellow)" },
  ],
} as const satisfies Record<string, readonly { d: string; fill?: string }[]>;

export type PixelIconName = keyof typeof grids | keyof typeof raw;
export const pixelIconNames = [...Object.keys(grids), ...Object.keys(raw)] as PixelIconName[];

/** One horizontal run per row, merged into a single path. */
function gridPath(grid: Grid): string {
  const parts: string[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < 8) {
      if (row[x] !== "#") { x++; continue; }
      let w = 1;
      while (x + w < 8 && row[x + w] === "#") w++;
      parts.push(`M${x} ${y}h${w}v1h-${w}z`);
      x += w;
    }
  });
  return parts.join("");
}

export function PixelIcon({
  name, size = 16, label, className = "", style,
}: {
  name: PixelIconName;
  /** Pixels. Use a multiple of 8. */
  size?: number;
  /** Set only when the icon is the whole content of a control; otherwise it is decoration. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const paths = name in grids
    ? [{ d: gridPath(grids[name as keyof typeof grids]), fill: "currentColor" as string }]
    : (raw[name as keyof typeof raw] as readonly { d: string; fill?: string }[]).map((p) => ({ d: p.d, fill: p.fill ?? "currentColor" }));
  return (
    <svg
      className={`st-icon ${className}`.trim()}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {paths.map((p, i) => <path key={i} d={p.d} fill={p.fill} />)}
    </svg>
  );
}
