import type { ComponentType, ReactNode } from "react";
import { artSlug, fallbackTilt } from "@/lib/studyapp/questions/setupBooks";

/**
 * EXERCISE BOOK ART: every drawing decision of the setup ("What are you studying?") lives in this file and in the matching
 * "EXERCISE BOOK ART" block of app/study/(app)/questions-setup.css. To change how the books look, edit BOOK_ART (a doodle, a cover
 * texture, a tape, a binding and a tilt per subject), DESK_ART (the doodles in the margin) or SETUP_ART (the tick stamp, the mascot and what its bubble says); nothing else in Setup knows what any of it looks like. Everything is inline SVG and CSS, no raster art.
 *
 * A doodle is a component with no props, drawn on a 64 by 64 box in `currentColor` (the book sets it to ink). Shapes that take the
 * accent colour use `fill="var(--qk-pop)"` (a warm yellow the CSS can change per book); shapes that are white paper use the
 * `PAPER` fill. The SVG is sized by CSS (`.qk-doodle svg`), so a final drawing of any size drops in.
 */

const PAPER = "rgba(255,255,255,.78)";
const POP = "var(--qk-pop, #f6cf6b)";

/** The shared frame of a doodle: a 64 box, drawn with a round pen. */
const Doodle64 = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);

/* ── the doodles ─────────────────────────────────────────────────────── */
const Beaker = () => (
  <Doodle64>
    <path d="M18.5 35c5-3.5 9 3 14 0s9 3 13.5 0V50a5 5 0 0 1-5 5H23.500a5 5 0 0 1-5-5z" fill={POP} stroke="none" />
    <path d="M18 10v40a5 5 0 0 0 5 5h18a5 5 0 0 0 5-5V10M14.500 10h35" />
    <path d="M18 20h6M18 28h4" />
    <circle cx="28" cy="43" r="2.400" fill={PAPER} /><circle cx="37" cy="46" r="1.700" fill={PAPER} /><circle cx="34" cy="24" r="1.600" /><circle cx="39" cy="17" r="2.200" />
  </Doodle64>
);
const Atom = () => (
  <Doodle64>
    <ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(30 32 32)" />
    <ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(90 32 32)" />
    <ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(150 32 32)" />
    <circle cx="32" cy="32" r="5" fill={POP} />
    <circle cx="53" cy="20" r="2.600" fill="currentColor" /><circle cx="14" cy="22" r="2.600" fill="currentColor" /><circle cx="32" cy="58" r="2.600" fill="currentColor" />
  </Doodle64>
);
const Calculator = () => (
  <Doodle64>
    <rect x="14" y="6" width="36" height="52" rx="6" fill={PAPER} />
    <rect x="19" y="11.500" width="26" height="11" rx="2.500" fill={POP} />
    <path d="M35 17h6" />
    <g fill="currentColor" stroke="none"><circle cx="24" cy="32" r="2.100" /><circle cx="32" cy="32" r="2.100" /><circle cx="40" cy="32" r="2.100" /><circle cx="24" cy="41" r="2.100" /><circle cx="32" cy="41" r="2.100" /><circle cx="40" cy="41" r="2.100" /><circle cx="24" cy="50" r="2.100" /><circle cx="32" cy="50" r="2.100" /></g>
    <rect x="36.500" y="46.500" width="7" height="7" rx="2" fill={POP} />
  </Doodle64>
);
const Pi = () => (
  <Doodle64>
    <path d="M10 20c8-4 28-6 44 0" strokeWidth="3.200" />
    <path d="M23 20c0 12-1 24-5 34" strokeWidth="3.200" />
    <path d="M41 20c-1 14 0 26 8 32" strokeWidth="3.200" />
    <path d="M52 8l1.500 4 4 1.500-4 1.500L52 19l-1.500-4-4-1.500 4-1.500z" fill={POP} strokeWidth="1.800" />
    <circle cx="10" cy="44" r="2.200" fill={POP} />
  </Doodle64>
);
const Leaf = () => (
  <Doodle64>
    <path d="M10 54C7 28 24 9 54 10c2 28-12 44-40 42z" fill={POP} />
    <path d="M10 54C24 40 36 28 48 16M27 38l9 1M34 30l8 0M21 44l-1 7" />
    <path d="M10 54l-4 6" />
  </Doodle64>
);
const FlaskFlame = () => (
  <Doodle64>
    <path d="M18.500 40c4-3 7 3 13 0s8 3 13.500 0l2 4a4 4 0 0 1-3.500 3H20a4 4 0 0 1-3.500-3z" fill={POP} stroke="none" />
    <path d="M26 5h12M28 5v15L14 40a4 4 0 0 0 3.500 6h29a4 4 0 0 0 3.500-6L36 20V5" />
    <path d="M10 49h44" />
    <path d="M32 62c-8-3-9-9-4-15 1 4 4 4 4 0 6 4 9 10 0 15z" fill={POP} strokeWidth="2.200" />
    <circle cx="30" cy="35" r="1.800" fill={PAPER} />
  </Doodle64>
);
const Globe = () => (
  <Doodle64>
    <circle cx="32" cy="30" r="23" fill={PAPER} />
    <path d="M18 24c3-6 9-6 11-2s-1 7-4 8-9 0-7-6zM37 36c3-3 8-2 9 1s-2 8-6 7-5-5-3-8z" fill={POP} strokeWidth="2.200" />
    <path d="M32 7c-12 12-12 34 0 46M32 7c12 12 12 34 0 46M9 30h46" strokeWidth="2.100" />
    <path d="M20 53c6 5 18 5 24 0M24 60h16" />
  </Doodle64>
);
const Quill = () => (
  <Doodle64>
    <path d="M52 7C32 8 17 24 14 44l-6 11 11-5c19-2 33-19 33-43z" fill={PAPER} />
    <path d="M14 44L46 14M25 33l9 1M32 26l9 0M21 40l-2-8" />
    <path d="M30 57c4-3 7 3 11 0s6 0 9-1" stroke={POP} strokeWidth="3.600" />
  </Doodle64>
);
const OpenBook = () => (
  <Doodle64>
    <path d="M32 18C26 12 15 12 6 14v37c9-2 20-2 26 4 6-6 17-6 26-4V14c-9-2-20-2-26 4z" fill={PAPER} />
    <path d="M32 18v37M12 23c5-1 11-1 15 1M12 30c5-1 11-1 15 1M12 37c5-1 11-1 15 1M37 24c4-2 10-2 15-1M37 31c4-2 10-2 15-1" strokeWidth="2.100" />
    <path d="M44 14v15l4-3.500 4 3.500V15" fill={POP} />
  </Doodle64>
);
const Scroll = () => (
  <Doodle64>
    <path d="M17 13h33v33c0 6 4 9 8 9H23c-4 0-6-3-6-9z" fill={PAPER} />
    <path d="M17 13c-5 0-8-2-8-5.500S12 3 15 3h35" />
    <path d="M58 55c4 0 5-3 5-5.500s-2-4-5-4" />
    <path d="M24 22h19M24 29h19M24 36h12" strokeWidth="2.200" /><circle cx="42" cy="40" r="4" fill={POP} strokeWidth="2" />
  </Doodle64>
);
const Bubble = ({ children, fill = PAPER }: { children: ReactNode; fill?: string }) => (
  <Doodle64>
    <path d="M10 10h44a5 5 0 0 1 5 5v25a5 5 0 0 1-5 5H33L19 57V45h-9a5 5 0 0 1-5-5V15a5 5 0 0 1 5-5z" fill={fill} />
    {children}
  </Doodle64>
);
const BubbleFrench = () => <Bubble><g fill="currentColor" stroke="none"><circle cx="21" cy="28" r="3" /><circle cx="32" cy="28" r="3" /><circle cx="43" cy="28" r="3" /></g></Bubble>;
const BubbleSpanish = () => <Bubble fill={POP}><path d="M23 19v8M23 33v.5M41 17v9M41 33v.5" strokeWidth="3.200" /><path d="M22 36c-1 2-3 3-4 3" strokeWidth="2" /></Bubble>;
const BubbleBengali = () => <Bubble><path d="M15 22h34M22 22v14M32 22c0 7 1 12 6 12M44 22v8c0 3-2 5-5 5" strokeWidth="2.600" /></Bubble>;
const Brain = () => (
  <Doodle64>
    <path d="M32 10c-3-5-12-5-15 1-6 0-9 7-6 12-3 4-1 10 4 12 1 6 9 8 13 4z" fill={POP} />
    <path d="M32 10c3-5 12-5 15 1 6 0 9 7 6 12 3 4 1 10-4 12-1 6-9 8-13 4z" fill={PAPER} />
    <path d="M32 10v36M22 22c3-2 6 0 6 3M42 22c-3-2-6 0-6 3M21 35c3-3 6-1 7 2M43 35c-3-3-6-1-7 2" strokeWidth="2.200" />
    <path d="M32 46v10M26 58h12" />
  </Doodle64>
);
const Laptop = () => (
  <Doodle64>
    <rect x="11" y="11" width="42" height="31" rx="4" fill={PAPER} />
    <path d="M4 48h56l-4 8H8z" fill={POP} />
    <path d="M25 20l-6 6.500 6 6.500M39 20l6 6.500-6 6.500M35 18l-6 17" strokeWidth="2.500" />
  </Doodle64>
);
const Briefcase = () => (
  <Doodle64>
    <path d="M23 22v-6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6" />
    <rect x="7" y="22" width="50" height="33" rx="5" fill={POP} />
    <path d="M7 37h50" /><rect x="27" y="33" width="10" height="9" rx="2" fill={PAPER} />
  </Doodle64>
);
const Coin = () => (
  <Doodle64>
    <circle cx="32" cy="32" r="24" fill={POP} />
    <circle cx="32" cy="32" r="18" strokeDasharray="3 4" strokeWidth="2" />
    <path d="M38 22c-1-5-12-6-12 3v9c0 5-2 6-4 8h21M21 33h16" strokeWidth="3" />
  </Doodle64>
);
const Scales = () => (
  <Doodle64>
    <path d="M32 8v47M20 56h24M10 17h44" />
    <path d="M10 17L4 36M10 17l6 19M54 17l-6 19M54 17l6 19" strokeWidth="2" />
    <path d="M2 36a8 5.500 0 0 0 16 0zM46 36a8 5.500 0 0 0 16 0z" fill={POP} />
    <circle cx="32" cy="8" r="3" fill={PAPER} />
  </Doodle64>
);
const Thought = () => (
  <Doodle64>
    <path d="M17 42a10 10 0 0 1 1-19 12 12 0 0 1 22-5 12 12 0 0 1 8 23 8 8 0 0 1-7 6H24a8 8 0 0 1-7-5z" fill={PAPER} />
    <path d="M27 29c0-5 9-5 9 0 0 4-4 4-4 8M32 43v.5" strokeWidth="3" />
    <circle cx="14" cy="54" r="3.200" fill={POP} /><circle cx="7" cy="60" r="1.800" fill={POP} />
  </Doodle64>
);
const Ballot = () => (
  <Doodle64>
    <rect x="21" y="6" width="22" height="30" rx="2" fill={PAPER} transform="rotate(-4 32 21)" />
    <path d="M27 20l4 5 7-10" strokeWidth="3" />
    <rect x="9" y="34" width="46" height="23" rx="3" fill={POP} />
    <path d="M23 40h18" strokeWidth="3.200" />
  </Doodle64>
);
const People = () => (
  <Doodle64>
    <circle cx="22" cy="20" r="7" fill={PAPER} /><circle cx="43" cy="22" r="6" fill={POP} />
    <path d="M7 54c0-11 6-17 15-17s15 6 15 17z" fill={PAPER} /><path d="M35 54c0-9 4-14 10-14s11 5 11 14z" fill={POP} />
  </Doodle64>
);
const Candle = () => (
  <Doodle64>
    <path d="M32 6c-8 8-8 15 0 18 8-3 8-10 0-18z" fill={POP} />
    <path d="M32 24v5" />
    <rect x="23" y="29" width="18" height="24" rx="3" fill={PAPER} />
    <path d="M23 38c4 3 7-2 11 1s5 1 7-1M15 55h34" />
  </Doodle64>
);
const PencilStar = () => (
  <Doodle64>
    <path d="M12 52l3.500-12L42 13.500l8.500 8.500L24 48.500z" fill={PAPER} />
    <path d="M37 19l8.500 8.500M15.500 40l8.500 8.500" /><path d="M12 52l5-1.500-3.500-3.500z" fill={POP} />
    <path d="M50 6l2.500 6 6 2.500-6 2.500-2.500 6-2.500-6-6-2.500 6-2.500z" fill={POP} strokeWidth="2" />
  </Doodle64>
);

/* ── the books: one entry per subject, keyed by its slug (artSlug) ──────────────────────────────── */
export type CoverTexture = "plain" | "grid" | "dots" | "lines" | "marble" | "waves" | "checks";
export type TapeStyle = "stripe" | "dots" | "gingham" | "zigzag" | "plain";
export type Binding = "spiral" | "stitch" | "staple";
export interface BookArtEntry {
  /** The doodle on the cover. */
  Doodle: ComponentType;
  /** The cover's print, drawn by `.qk-cover--<texture>` in the CSS. */
  cover: CoverTexture;
  /** The washi tape on the corner, `.qk-tape--<style>`. */
  tape: TapeStyle;
  /** The edge: a spiral of rings, a line of stitches, or two staples. */
  binding: Binding;
  /** Degrees; a book at rest sits this crooked and straightens when picked up. */
  tilt: number;
  /** How tall the book stands on the shelf: s, m or l (heights are in the CSS). */
  size: "s" | "m" | "l";
}

export const BOOK_ART: Record<string, BookArtEntry> = {
  maths: { Doodle: Calculator, cover: "grid", tape: "stripe", binding: "spiral", tilt: -2.2, size: "m" },
  "further-maths": { Doodle: Pi, cover: "grid", tape: "zigzag", binding: "spiral", tilt: 1.8, size: "l" },
  biology: { Doodle: Leaf, cover: "dots", tape: "gingham", binding: "stitch", tilt: 1.6, size: "l" },
  chemistry: { Doodle: Beaker, cover: "marble", tape: "dots", binding: "spiral", tilt: -1.4, size: "m" },
  physics: { Doodle: Atom, cover: "lines", tape: "zigzag", binding: "spiral", tilt: 2.4, size: "s" },
  "combined-science": { Doodle: FlaskFlame, cover: "checks", tape: "stripe", binding: "spiral", tilt: -1.8, size: "l" },
  geography: { Doodle: Globe, cover: "waves", tape: "gingham", binding: "stitch", tilt: 1.2, size: "m" },
  history: { Doodle: Scroll, cover: "marble", tape: "plain", binding: "stitch", tilt: -2.6, size: "s" },
  "english-language": { Doodle: Quill, cover: "lines", tape: "dots", binding: "stitch", tilt: 1.9, size: "m" },
  "english-literature": { Doodle: OpenBook, cover: "checks", tape: "stripe", binding: "stitch", tilt: -1.2, size: "l" },
  french: { Doodle: BubbleFrench, cover: "waves", tape: "stripe", binding: "staple", tilt: 2.1, size: "s" },
  spanish: { Doodle: BubbleSpanish, cover: "checks", tape: "zigzag", binding: "staple", tilt: -1.6, size: "m" },
  bengali: { Doodle: BubbleBengali, cover: "dots", tape: "gingham", binding: "staple", tilt: 1.3, size: "l" },
  psychology: { Doodle: Brain, cover: "waves", tape: "dots", binding: "stitch", tilt: -2, size: "m" },
  "computer-science": { Doodle: Laptop, cover: "lines", tape: "plain", binding: "spiral", tilt: 1.5, size: "s" },
  business: { Doodle: Briefcase, cover: "plain", tape: "stripe", binding: "stitch", tilt: -1.7, size: "l" },
  economics: { Doodle: Coin, cover: "checks", tape: "dots", binding: "staple", tilt: 2.3, size: "m" },
  law: { Doodle: Scales, cover: "marble", tape: "plain", binding: "stitch", tilt: -1.3, size: "s" },
  philosophy: { Doodle: Thought, cover: "lines", tape: "gingham", binding: "staple", tilt: 1.7, size: "m" },
  politics: { Doodle: Ballot, cover: "plain", tape: "zigzag", binding: "stitch", tilt: -2.1, size: "l" },
  sociology: { Doodle: People, cover: "dots", tape: "stripe", binding: "staple", tilt: 1.1, size: "s" },
  "religious-studies": { Doodle: Candle, cover: "waves", tape: "dots", binding: "stitch", tilt: -1.5, size: "m" },
};

const TEXTURES: CoverTexture[] = ["lines", "dots", "grid", "waves", "checks", "marble"];
const TAPES: TapeStyle[] = ["stripe", "dots", "gingham", "zigzag"];
const BINDINGS: Binding[] = ["stitch", "spiral", "staple"];
const SIZES: BookArtEntry["size"][] = ["m", "s", "l"];
const hash = (s: string) => { let h = 5; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

/** The art for a subject: its own entry, or (for a subject nobody has drawn yet) a generic pencil and star with a cover chosen from its name, the same every time. */
export function bookArt(base: string): BookArtEntry {
  const slug = artSlug(base);
  const own = BOOK_ART[slug];
  if (own) return own;
  const h = hash(slug);
  return { Doodle: PencilStar, cover: TEXTURES[h % TEXTURES.length], tape: TAPES[(h >>> 3) % TAPES.length], binding: BINDINGS[(h >>> 5) % BINDINGS.length], tilt: fallbackTilt(slug), size: SIZES[(h >>> 7) % SIZES.length] };
}

/* ── the stickers on a book ──────────────────────────────────────────── */
/** The hand-drawn tick stamp: a wobbly ring and a bold tick, in `currentColor`. */
const TickStamp = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M32 5c15 0 27 11 27 26.500S47.500 59 32 59 5 47 5 31.500C5 17 16 5 32 5z" strokeWidth="3.400" />
    <path d="M32 11c11.500 0 21 8.500 21 20.500" strokeWidth="1.600" strokeDasharray="2 4" />
    <path d="M17 33l10.500 11.500L48 19" strokeWidth="6.500" />
  </svg>
);
export const SETUP_ART = { TickStamp, mascot: "/study/mascot/plumi-welcoming.svg", bubble: "Tick your subjects." } as const;

/* ── the desk: the doodles in the margin of the ruled page (positions are `.qk-d-*` in the CSS) ──────── */
const Star = () => (
  <svg viewBox="0 0 32 32" fill="var(--qk-pop, #f6cf6b)" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M16 3l3.800 8.200 8.700 1-6.500 6 1.800 8.800L16 22.600 8.200 27l1.800-8.800-6.500-6 8.700-1z" /></svg>
);
const Heart = () => (
  <svg viewBox="0 0 32 32" fill="#f3b3b0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M16 27C6 20 4 14 4 10.500 4 7 6.800 5 9.800 5c2.600 0 4.600 1.600 6.200 4 1.600-2.400 3.600-4 6.200-4C25.200 5 28 7 28 10.500 28 14 26 20 16 27z" /></svg>
);
const Sparkle = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M16 4v8M16 20v8M4 16h8M20 16h8M8 8l4 4M20 20l4 4M24 8l-4 4M12 20l-4 4" /></svg>
);
const Mug = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path className="qk-steam qk-steam-a" d="M22 24c-4-4 4-6 0-11M32 24c-4-4 4-6 0-11" strokeWidth="2.200" />
    <path d="M12 28h34v14a14 14 0 0 1-14 14h-6a14 14 0 0 1-14-14z" fill="#fbe6d2" />
    <path d="M46 33h4a6 6 0 0 1 0 12h-5" />
    <path d="M29 47c-5-3-6-7-3-9 2-1 3 0 3 1 0-1 1-2 3-1 3 2 2 6-3 9z" fill="#f3b3b0" strokeWidth="1.800" />
    <path d="M10 60h40" />
  </svg>
);
const Lamp = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M32 0v16" />
    <path d="M13 38a19 19 0 0 1 38 0z" fill="var(--qk-pop, #f6cf6b)" />
    <path d="M9 38h46" />
    <path d="M25 43a7 7 0 0 0 14 0" strokeWidth="2.200" />
    <path d="M16 49l-4 5M32 52v7M48 49l4 5" strokeWidth="2.200" opacity=".6" />
  </svg>
);
export interface DeskDoodle { id: string; Art: ComponentType }
/** Each id is a class `qk-d-<id>` in the CSS that says where it sits; the desk hides the ones that do not fit on a narrow screen. */
export const DESK_ART: DeskDoodle[] = [
  { id: "lamp", Art: Lamp }, { id: "mug", Art: Mug }, { id: "star1", Art: Star }, { id: "star2", Art: Star }, { id: "star3", Art: Star },
  { id: "heart1", Art: Heart }, { id: "heart2", Art: Heart }, { id: "spark", Art: Sparkle },
];
