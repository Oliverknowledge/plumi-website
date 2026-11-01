import { totalHere, type LobbyServers } from "../../social/lobby";

/**
 * The front door of the Grand Library (components/studyapp/library/EntryScreen.tsx): the logic that does not need a
 * browser, so it is tested (entry.test.ts). When the door is shown, what the scene looks like at this hour, the
 * two truthful lines under the key, how the art is fetched before the student presses Enter, and when the
 * transition may go on. See docs/study/library.md, "Entry screen".
 */

/* ── When the door is shown ─────────────────────────────────────────── */

/**
 * A student who was in the room and stepped out (to the Desk, to flashcards) comes back to the room without the door
 * for this long; after it, Study is a place they walk into again. Reloading the page always shows the door: the
 * browser forgot the full screen and the sound, and the press is what asks for both again.
 */
export const QUICK_RETURN_MS = 10 * 60_000;

export function shouldShowEntry(o: { leftAt: number | null; now: number; forced?: boolean }): boolean {
  if (o.forced) return true;
  if (o.leftAt === null) return true;
  const away = o.now - o.leftAt;
  return !(away >= 0 && away < QUICK_RETURN_MS);
}

/** What this tab remembers about the student's visit (reset by a reload, which is the point). */
let leftAt: number | null = null;
let inside = 0;
export const entryMemory = {
  get leftAt() { return inside > 0 ? null : leftAt; },
  entered() { inside += 1; },
  left(now: number = Date.now()) { inside = Math.max(0, inside - 1); if (inside === 0) leftAt = now; },
  /** Tests only. */
  reset() { leftAt = null; inside = 0; },
};

/* ── The hour and the season ────────────────────────────────────────── */

export type TimeOfDay = "dawn" | "day" | "evening" | "night";
export type Season = "spring" | "summer" | "autumn" | "winter";

/** The student's own clock: dawn 05 to 08, day 08 to 17, evening 17 to 20, night 20 to 05. */
export function timeOfDay(hour: number): TimeOfDay {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}

/** The UK's meteorological seasons (month 0 to 11). */
export function seasonOf(month: number): Season {
  const m = ((Math.floor(month) % 12) + 12) % 12;
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

/* ── The two lines under the key ────────────────────────────────────── */

const count = (n: number) => n.toLocaleString("en-GB");

/** How many students are studying right now (the servers' own total), or nothing at all when it is not known. */
export function liveLine(total: number | null): string | null {
  if (total === null || !Number.isFinite(total) || total < 0) return null;
  if (total === 0) return "The library is quiet. Be the first in";
  return `${count(total)} ${total === 1 ? "student" : "students"} studying right now`;
}

/** How many friends are in, summed over every library (`lobby_servers` counts them; it never says who). */
export function friendsIn(s: LobbyServers): number {
  return s.servers.reduce((n, x) => n + Math.max(0, x.friends), 0);
}
export { totalHere };

/**
 * Who is in. Names only when the page really knows them (the room published them moments ago and the count still
 * agrees); otherwise the count, which is what the server says. Nothing when there is nobody or it is not known.
 */
export function friendsLine(n: number | null, names: readonly string[] | null): string | null {
  if (n === null || !Number.isFinite(n) || n <= 0) return null;
  const known = names && names.length === n && names.every((x) => x.trim()) ? names.map((x) => x.trim()) : null;
  if (!known) return n === 1 ? "1 friend is in" : `${count(n)} friends are in`;
  if (n === 1) return `${known[0]} is in`;
  if (n === 2) return `${known[0]} and ${known[1]} are in`;
  if (n === 3) return `${known[0]}, ${known[1]} and ${known[2]} are in`;
  return `${known[0]}, ${known[1]} and ${n - 2} more are in`;
}

/** Names are trusted only this long after the room last published them (they are not on the server's count). */
export const NAMES_FRESH_MS = 2 * 60_000;
export const namesAreFresh = (leftAt: number | null, now: number) => leftAt !== null && now - leftAt >= 0 && now - leftAt < NAMES_FRESH_MS;

export const HIDDEN_NOTE = "You’re hidden, so nobody will see you";

/**
 * The room's art (960 x 656) is drawn at a whole number of times its size, so its pixels stay square: the smallest that
 * covers the window with the doorway's view (art point FOCUS at FOCUS_AT of the window's height) and a margin for the
 * parallax, and never less than 2 (one pixel to the screen pixel is too small to be out of focus nicely). Written
 * straight to a CSS variable; the stylesheet has a fallback for the first paint.
 */
export const ART = { w: 960, h: 656, margin: 32, focusY: 250, focusAt: 0.46 } as const;
export function coverScale(w: number, h: number): number {
  const need = Math.max(
    (w + ART.margin) / ART.w,
    ((h + ART.margin) * ART.focusAt) / ART.focusY,
    ((h + ART.margin) * (1 - ART.focusAt)) / (ART.h - ART.focusY),
  );
  return Math.max(2, Math.ceil(need));
}

/* ── The lamplight behind the door ───────────────────────────────────── */

/**
 * The room's own lights (public/library/layout.json `lights`: x, y, radius and strength in art pixels, colour, and
 * whether it is the fire), so the door's picture is lit where the room is lit. Same numbers; `entry.test.ts` holds them
 * to the file.
 */
export const LAMPS: readonly (readonly [number, number, number, number, number, number, number, number])[] = [
  [480, 278, 80, 0.3, 255, 176, 104, 1],
  [348, 380, 30, 0.18, 255, 210, 140, 0], [348, 450, 30, 0.18, 255, 210, 140, 0], [348, 520, 30, 0.18, 255, 210, 140, 0],
  [424, 380, 30, 0.18, 255, 210, 140, 0], [424, 450, 30, 0.18, 255, 210, 140, 0], [424, 520, 30, 0.18, 255, 210, 140, 0],
  [500, 380, 30, 0.18, 255, 210, 140, 0], [500, 450, 30, 0.18, 255, 210, 140, 0], [500, 520, 30, 0.18, 255, 210, 140, 0],
  [576, 380, 30, 0.18, 255, 210, 140, 0], [576, 450, 30, 0.18, 255, 210, 140, 0], [576, 520, 30, 0.18, 255, 210, 140, 0],
  [600, 122, 34, 0.2, 255, 236, 200, 0], [684, 122, 34, 0.2, 255, 236, 200, 0], [768, 122, 34, 0.2, 255, 236, 200, 0], [852, 122, 34, 0.2, 255, 236, 200, 0],
  [126, 40, 34, 0.14, 200, 220, 255, 0], [328, 40, 34, 0.14, 200, 220, 255, 0], [614, 40, 34, 0.14, 200, 220, 255, 0], [814, 40, 34, 0.14, 200, 220, 255, 0],
  [800, 320, 50, 0.2, 255, 210, 140, 0], [770, 430, 40, 0.2, 255, 210, 140, 0], [570, 600, 44, 0.18, 255, 210, 140, 0],
  [150, 590, 70, 0.26, 255, 190, 120, 0], [860, 560, 60, 0.24, 255, 210, 140, 0], [760, 560, 30, 0.18, 255, 210, 140, 0],
];

const GAIN = 4.2;
const glow = ([x, y, r, k, cr, cg, cb]: (typeof LAMPS)[number]) => {
  const a = Math.min(0.95, k * GAIN), c = `${cr}, ${cg}, ${cb}`;
  const px = (n: number) => `calc(var(--en-k) * ${n}px)`;
  return `radial-gradient(ellipse ${px(r * 1.4)} ${px((r * 1.4) / 1.5)} at ${px(x)} ${px(y)}, rgba(${c}, ${a.toFixed(2)}), rgba(${c}, ${(a * 0.42).toFixed(2)}) 42%, rgba(${c}, 0) 100%)`;
};
/** CSS backgrounds (one layer each, so the whole lamplight costs three): the fire, the table candles, and the steady lamps. Sized in `--en-k` art pixels. */
export function lampLayers(): { fire: string; tables: string; steady: string } {
  const fire = LAMPS.filter((l) => l[7] === 1);
  const tables = LAMPS.filter((l) => l[7] === 0 && l[1] >= 370 && l[1] <= 530 && l[0] >= 340 && l[0] <= 590);
  const steady = LAMPS.filter((l) => !fire.includes(l) && !tables.includes(l));
  const join = (ls: typeof LAMPS) => ls.map(glow).join(", ");
  return { fire: join(fire), tables: join(tables), steady: join(steady) };
}

/* ── Getting the room ready while the door is up ────────────────────── */

const BASE = "/library/";
/** What the room draws with, in the order it needs it (the engine's own list: cafeScene.ts `loadAssets`). */
export const ROOM_ART = ["bg.png", "pieces.png", "anims.png", "people.png"].map((n) => BASE + n);
export const ROOM_LAYOUT = BASE + "layout.json";

export interface PreloadDeps {
  /** `import("@/components/landing/cafeScene")` */
  engine: () => Promise<unknown>;
  /** Fetch and decode one picture. */
  image: (url: string) => Promise<unknown>;
  /** Fetch one JSON file. */
  json: (url: string) => Promise<unknown>;
  /** The people layers (0.6 MB, only the Study page loads them): resolves true when they are there. */
  people: () => Promise<boolean>;
  now?: () => number;
}
export interface PreloadReport { loaded: string[]; failed: string[]; ms: number }

/**
 * Everything the room needs, fetched before Enter so pressing it is instant. Two waves: the engine and the art the
 * first frame needs, then the people layers (the room opens with the premade look if they are late). It never
 * throws and never joins the lobby: being on the door announces nobody.
 */
export async function preloadRoom(d: PreloadDeps): Promise<PreloadReport> {
  const now = d.now ?? Date.now;
  const t0 = now();
  const loaded: string[] = [], failed: string[] = [];
  const note = async (name: string, job: () => Promise<unknown>) => {
    try { const r = await job(); (r === false ? failed : loaded).push(name); } catch { failed.push(name); }
  };
  await Promise.all([
    note("engine", d.engine),
    note("layout", () => d.json(ROOM_LAYOUT)),
    ...ROOM_ART.map((u) => note(u, () => d.image(u))),
  ]);
  await note("people", d.people);
  return { loaded, failed, ms: now() - t0 };
}

/* ── The transition ─────────────────────────────────────────────────── */

/** Milliseconds: the press settles and the door starts to move, then the room is walked into. About 1.1 s in all. */
export const OUTRO = { press: 300, go: 700, quick: 420, reduced: 220, giveUp: 4000 } as const;
export type Stage = "door" | "press" | "go";

/**
 * How many more milliseconds to wait before the transition moves from the press into the walk: the room has to be drawn
 * and the press has to have had its moment (0 once both are true; never longer than `giveUp` after the press, so
 * nobody is stuck at the door when the room never draws).
 */
export function goDelay(o: { elapsed: number; ready: boolean; reduced: boolean; quick: boolean }): number {
  const left = Math.max(0, OUTRO.giveUp - o.elapsed);
  if (!o.ready) return left;
  const need = o.quick || o.reduced ? 0 : OUTRO.press;
  return Math.max(0, Math.min(need - o.elapsed, left));
}
export const readyToGo = (o: { elapsed: number; ready: boolean; reduced: boolean; quick: boolean }) => goDelay(o) === 0;

/** How long the walk takes (the overlay is gone after it). */
export const goMs = (o: { reduced: boolean; quick: boolean }) => (o.reduced ? OUTRO.reduced : o.quick ? OUTRO.quick : OUTRO.go);
