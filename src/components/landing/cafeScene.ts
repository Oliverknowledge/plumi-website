/**
 * The homepage's living library: the co-founder's Grand Library (LimeZu Modern Interiors, full
 * licence), Plumi's launch room, drawn on a <canvas>, with simulated students studying on both
 * floors and the visitor's own person to walk about and sit down. The window shows part of the
 * room and follows the visitor; point at (or tap) anyone to see who they are and what they're on.
 *
 * Only derived art is served (public/library, made by scripts/cafe-hero/export_library.py): the
 * empty room as one picture, the pieces people can be behind cut from it, the animation as the
 * pixels that change, and a cast of looks as composed frame strips. Credit: limezu.itch.io.
 *
 * Drawing follows the kit: the room, then everything that stands on the floor in order of the y
 * it stands on (pieces, moving things, people), then the lamplight over all of it, as the kit
 * lights its renders. Everything is drawn at art size and scaled up by whole pixels where it can.
 *
 * Browser only, and loaded with import() after first paint (CafeScene in LandingClient.tsx).
 */

import { artUrl } from "@/lib/studyapp/library/art";
/** Library mode's free movement: the pure maths (src/lib/studyapp/library/walk.ts), loaded only when the library mounts, so the homepage's chunk never carries it. */
type Walk = typeof import("@/lib/studyapp/library/walk");

type Dir = "right" | "back" | "left" | "front";
const DIRS: readonly Dir[] = ["right", "back", "left", "front"];

interface Spot {
  role: "seat" | "sofa" | "queue" | "browse" | "barista";
  pose: "sit" | "idle" | "read" | "phone" | "stool";
  staff?: "librarian" | "butler";
  face: Dir;
  x: number; y: number; sort: number;
  tile: [number, number];
  who?: Person | null;
}
interface Piece { x: number; y: number; w: number; h: number; z: number; ax: number; ay: number }
interface Anim { x: number; y: number; w: number; h: number; z: number; frames: [number, number][]; seq: number[] }
interface Light { x: number; y: number; r: number; k: number; rgb: [number, number, number]; sq: number; fire: boolean }
interface Layout {
  w: number; h: number; tile: number; cols: number; rows: number; wallH: number; fps: number; loop: number;
  door: { x: number; y: number; tile: [number, number] };
  walk: string[]; spots: Spot[]; pieces: Piece[]; anims: Anim[]; lights: Light[];
  people: { looks: number; choose: number; staff: Record<"librarian" | "butler", number>; frames: number; rows: Record<"idle" | "walk" | "sit" | "phone" | "read" | "stool", number>; phones: boolean[] };
}
interface Assets { L: Layout; bg: HTMLImageElement; pieces: HTMLImageElement; anims: HTMLImageElement; people: HTMLImageElement }

const BASE = "/library/";
/** The most device pixels the study app's room paints (1280 x 800 at 2x is 4.1 million, and stays whole; 4K at 2x is 33). */
const LIBRARY_PIXELS = 6_000_000;
/** The homepage asks for the art by its plain URL (landing.css shares those files); the study app's room asks for its fingerprinted URL, cached for a year. */
const loading: Record<"plain" | "versioned", Promise<Assets> | null> = { plain: null, versioned: null };

function image(name: string, url: (n: string) => string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`cafe: ${name}`));
    im.src = url(name);
  });
}

function loadAssets(versioned = false): Promise<Assets> {
  const kind = versioned ? "versioned" : "plain";
  const url = versioned ? artUrl : (n: string) => BASE + n;
  const p = (loading[kind] ??= Promise.all([
    fetch(url("layout.json")).then(r => { if (!r.ok) throw new Error("layout.json"); return r.json() as Promise<Layout>; }),
    image("bg.png", url), image("pieces.png", url), image("anims.png", url), image("people.png", url),
  ]).then(([L, bg, pieces, anims, people]) => ({ L, bg, pieces, anims, people })));
  p.catch(() => { if (loading[kind] === p) loading[kind] = null; });
  return p;
}

/* ---------- the lamplight: the kit's Canvas.light, composited once into an overlay ---------- */
function lightLayer(L: Layout, lights: Light[], boost = 0): HTMLCanvasElement {
  const { w, h } = L, n = w * h;
  const A = new Float32Array(n), R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n);
  for (const lt of lights) {
    const k = lt.k + boost, [cr, cg, cb] = lt.rgb;
    const x0 = Math.max(0, Math.floor(lt.x - lt.r)), x1 = Math.min(w - 1, Math.ceil(lt.x + lt.r));
    const y0 = Math.max(0, Math.floor(lt.y - lt.r / lt.sq)), y1 = Math.min(h - 1, Math.ceil(lt.y + lt.r / lt.sq));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - lt.x, (y - lt.y) * lt.sq) / lt.r;
      if (d >= 1) continue;
      const q = k * Math.pow(1 - d, 1.6), i = y * w + x, keep = 1 - q;
      A[i] = q + A[i] * keep; R[i] = cr * q + R[i] * keep; G[i] = cg * q + G[i] * keep; B[i] = cb * q + B[i] * keep;
    }
  }
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const c = cv.getContext("2d")!, img = c.createImageData(w, h), d = img.data;
  for (let i = 0; i < n; i++) {
    const a = A[i];
    if (a <= 0) continue;
    d[i * 4] = R[i] / a; d[i * 4 + 1] = G[i] / a; d[i * 4 + 2] = B[i] / a; d[i * 4 + 3] = Math.round(a * 255);
  }
  c.putImageData(img, 0, 0);
  return cv;
}

/**
 * One thing to draw this frame, in depth order. Kept in a pool and reused, so a frame makes no garbage: it used to make
 * an object and a closure for every piece, animation, person and ring in view, about 30 times a second.
 */
interface DrawItem {
  z: number;
  kind: 1 | 2 | 3 | 4;            // 1 animation, 2 piece, 3 person, 4 chair ring
  an: Anim | null; pc: Piece | null; p: Person | null;
  img: CanvasImageSource | null;
  x: number; y: number;           // where (a person's or a ring's sprite top left)
  f: number; sy: number;          // a person's frame and the row of their sheet
  fx: number; fy: number;         // an animation's frame in its sheet
  outline: boolean;
  shadow: boolean;                // library mode: a soft ground shadow under a person who stands
}
const byDepth = (p: DrawItem, q: DrawItem) => p.z - q.z;

/* ---------- people ---------- */
type Doing = "enter" | "walk" | "sit" | "stand" | "leave" | "idle";
interface Person {
  look: number;
  x: number; y: number;           // feet, in art pixels
  dir: Dir;
  doing: Doing;
  path: [number, number][];       // feet points still to walk to
  spot: Spot | null;              // the seat or spot they hold (walking to it, or at it)
  at: boolean;                    // at the spot (drawn in its pose)
  until: number;                  // when the current activity ends
  next: "seat" | "leave" | "stand" | null;
  phase: number;
  alpha: number;
  you?: boolean;
  name?: string;                  // a friend in the friends' window: always labelled, never leaves
  who: string;                    // what the card calls them
  staff?: "librarian" | "butler";
  subject: string; mins: number; since: number;  // what their focus timer says, from when
  speed: number;
  id?: string;                    // library mode: a real person, by their id
  remote?: boolean;
  known?: boolean;                // library mode: they have said where they stand
  rev?: number;                   // library mode: the last news about their place that was acted on
  said?: boolean;                 // library mode: whether the server last said they are seated
  sheet?: CanvasImageSource | null; // library mode: this person drawn from their own avatar (1248 x 32, the 78 frames of one people.png row); else the premade `look`
  sheetPhones?: boolean;          // ... and whether they wear headphones (the music notes)
  fw?: number;                    // library mode: the width of one frame of `sheet`, when it is not the people's 16 (the fox's is 34); the feet stay under the middle
  moving?: boolean;               // library mode, you: walking under the keys (not along a path)
  stride: number;                 // library mode: seconds this walk has lasted (the walk's own pose clock; 0 while not walking)
  still: number;                  // library mode: seconds standing in the same place (a person who has just stopped holds one pose)
  lx: number; ly: number;         // library mode: where they were at the last step (to tell standing still from being put somewhere)
}

const SUBJECTS = ["Physics", "Maths", "Chemistry", "Biology"];
/** Each subject's colour, as on the homepage's shelf of books. */
const SUBJECT_COLOURS: Record<string, string> = { Physics: "#f2c96b", Maths: "#6a9bd0", Chemistry: "#8fd0a0", Biology: "#eaa99a" };
const NAMES = ["Priya", "Oliver", "Amara", "Leo", "Zara", "Ethan", "Chloe", "Hamza", "Freya", "Kai", "Ruby", "Isaac", "Noor",
  "Theo", "Ellie", "Yusuf", "Grace", "Arjun", "Mia", "Reuben", "Sofia", "Imani", "Finn", "Hannah", "Omar", "Lily", "Jamal",
  "Evie", "Rohan", "Ava", "Tomás", "Layla", "Ben", "Niamh", "Kofi", "Ines", "Callum", "Mei", "Adam", "Tara", "Felix", "Hana"];
const STAFF = { librarian: { name: "Mrs Okafor", line: "The librarian" }, butler: { name: "Jeeves", line: "The butler. Ask me anything!" } } as const;
const POPS = ["✓ 3/3", "+1 ink", "✓ 5/6", "+1 ink", "✓ 4/4", "+10 ink", "✓ 2/2"];
const NOTE = [[1, 0], [2, 0], [2, 1], [2, 2], [0, 3], [1, 3], [2, 3], [0, 4], [1, 4]];
const NOTE_COLS = ["rgb(244,170,160)", "rgb(169,203,235)", "rgb(242,201,107)", "rgb(178,224,200)"];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

export interface CafeStatus { seated: boolean; seconds: number; look: number; subject: string | null }

/** The class names the engine gives its labels, pops and cards. The homepage's own (`lp-*`) unless a page says otherwise. */
export interface CafeClasses { nm: string; timer: string; you: string; pop: string; tick: string; ink: string; who: string; bub: string }
const LP_CLASSES: CafeClasses = { nm: "lp-nm", timer: "lp-nm is-timer", you: "lp-nm is-you", pop: "lp-pop", tick: "is-tick", ink: "is-ink", who: "lp-who", bub: "lp-bub" };

export interface CafeOptions {
  /** "library" is the study app's Grand Library: the same room and engine, with real people driven from outside (`live`). */
  mode: "hero" | "friends" | "library";
  reduced: boolean;
  look?: number;
  onStatus?: (s: CafeStatus) => void;
  /** Library mode only: where people come from and where your own steps go. */
  live?: LiveHooks;
  /** Class names for labels and pops (library mode brings its own, so the homepage's stylesheet is not needed). */
  cls?: Partial<CafeClasses>;
  /** Library mode only: you, drawn from your own avatar (see `LiveRemote.sheet`), from the first frame. */
  youSheet?: { sheet: CanvasImageSource; phones: boolean; frameW?: number } | null;
}
export interface CafeHandle {
  destroy(): void;
  setLook(look: number): void;
  readonly looks: number;
  readonly look: number;
}

/* ---------- library mode: the study app's room, with real people ---------- */

/** A point in art pixels (a sprite's top left, or a waypoint of one). */
export type ArtPoint = readonly [x: number, y: number];
/** A chair, as the study app's room table lists it (src/lib/studyapp/library/room.ts `seatTable`). */
export interface LiveSeat { ipad: number | null; spot: number | null; x: number; y: number; face: Dir; table: string }
/** Someone else, as the controller tells the engine: where they stand, the seat they sit in, the walk they are on. */
export interface LiveRemote {
  id: string; look: number; pos: ArtPoint | null; seat: number | null; path: ArtPoint[]; seated: boolean;
  /** This person drawn from their avatar: one row of people.png's 78 frames (1248 x 32). While it is absent (the layers are loading, or failed) they wear the premade `look`. */
  sheet?: CanvasImageSource | null;
  /** Whether that drawn person wears headphones. */
  phones?: boolean;
  /** The width of one frame of `sheet` (default 16, a person's; the fox's is 34). The feet are under the middle of the frame, so the engine's places (all of them the 16 wide sprite's) are unchanged. */
  frameW?: number;
  /** Which piece of news about their place this is: the room acts on each once, so a walk is not restarted every time the list is read. */
  rev: number;
}
/** You, as the controller needs to tell everyone: the sprite's top left, your seat, the rest of your walk. */
export interface LiveYou { x: number; y: number; seat: number | null; path: ArtPoint[]; walking: boolean }
export interface LiveLabel { name: string; tag: string | null; friend: boolean; pro: boolean }
export interface LiveHooks {
  /** The seats you and others may take, in the iPad's order, from this layout's spots. */
  seats(spots: readonly { x: number; y: number; role: string; pose: string; face: string }[]): LiveSeat[];
  /** You walked, sat or stood: say so (read `youNow()` for where). */
  onYou?: () => void;
  /** Someone's person was tapped (their id), or nobody. */
  onPick?: (id: string | null) => void;
  /** What to write over someone's head: their name, and "Physics \u00b7 12 min" while they are timing. */
  describe?: (id: string) => LiveLabel | null;
}
export interface LibraryHandle extends CafeHandle {
  /** Tell the room who else is in it (everyone not listed leaves). */
  setRemotes(list: readonly LiveRemote[]): void;
  /** Where you are, for the others; null before you have come in. */
  youNow(): LiveYou | null;
  /** Sit in the free seat nearest you; false when there is none you can reach. */
  sit(): boolean;
  /** Sit in the iPad's seat number `ipad`, if it is free. */
  sitIn(ipad: number): boolean;
  stand(): void;
  /** Walk to the free seat nearest them, as "Pull up a chair". */
  goTo(id: string): boolean;
  /** Highlight someone (or nobody). */
  select(id: string | null): void;
  /** A short word over someone's head ("Wave"), or yours (`"you"`). */
  say(who: string, text: string): void;
  /**
   * A speech bubble over someone's head (or yours, `"you"`) for `ms`: one per person (a new one replaces theirs), and
   * never so many they pile up. False when they are not in the room, or there is no room for it.
   */
  bubble(who: string, text: string, ms: number): boolean;
  /** Centre the view on someone until you walk, sit or stand (or `lookAt(null)`); false when they are not in the room. */
  lookAt(id: string | null): boolean;
  /** Draw you as this person (your avatar changed, or the art came late); null goes back to the premade look. */
  dressYou(sheet: CanvasImageSource | null, phones?: boolean, frameW?: number): void;
  /** Whether you are in a seat. */
  readonly seated: boolean;
}

/** A frame width other than the people's 16, or undefined for the people's: everything that is not a wide frame takes the exact old paths. */
const wide = (w: number | undefined): number | undefined => (w !== undefined && w > 16 && w <= 64 ? Math.round(w) : undefined);

/** How fast everyone in the library walks, in art pixels a second: LibraryScene.speed (140 points a second) over two. */
const LIVE_SPEED = 70;
/*
 * Library mode's movement feel (docs/study/library.md "Movement", tools/movement). None of this touches the homepage's
 * hero and friends windows: they keep the 30 Hz step, whole art pixel placement and the shared 5 Hz walk clock.
 */
/** A walk's poses change this many times a second, counted from the step the walk began (the same for people and animals). */
const POSE_HZ = 12;
/** A person who has just stopped holds one pose for this long (room seconds) before the standing frames start to move. */
const STILL_FIRST = 2;
/** How fast the camera catches up with someone it is not yet locked to, art pixels a second (you walk at 70). */
const CATCH_UP = 200;
/** The time constant of the camera's ease (a look at someone, a seat taken, the entrance): the old per-step 12 percent at 30 Hz, as seconds. */
const EASE_TAU = 0.26;
/** Present at 60 Hz: a display frame is taken when this many ms have passed (a little under 1000 / 60, so 60 and 120 Hz screens keep pace). */
const GAP_60 = 1000 / 60 - 2.5;
/** Present at about 30 Hz (the old gate): while nothing moves, and as the fallback. */
const GAP_30 = 1000 / 32;
/** The frame governor: 60 Hz is kept while the rolling 95th percentile of a frame's own work (step and draw) stays under this many ms. */
const GOV_KEEP_MS = 8;
/** ... and is tried again after a fallback only when that percentile is under this (hysteresis), and not before the hold has passed. */
const GOV_RETURN_MS = 5;
/** A frame this late (ms since the one before) missed a display refresh; a quarter of the last 90 doing so is a fallback too. */
const GOV_LATE_MS = 24;
const GOV_WINDOW = 90;
/** The soft shadow under a standing person: stepped rows of this many art pixels wide, 14 across and 4 high. The reference's is 0.475 of the body's height measured as the patch you can see round the feet; a body 25 rows tall hides the middle of it, so the whole ellipse is a little wider (0.56) to show that much. */
const SHADOW_ROWS = [10, 14, 14, 10] as const;
const SHADOW_RGB = "rgb(44,14,86)";
const SHADOW_ALPHA = .5;
const OUTLINE: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** While you walk under the keys your place goes out about this often (room seconds): over the wire's 100 ms floor, so no step is held back. */
const YOU_GAP = 0.11;
/** A free chair is "near" when its standing place or its seat is within this many art pixels of your feet. */
const NEAR_SEAT = 20;
/** Where a chair's ring is centred, from the sprite's top left (the iPad's `LibraryChair`: spriteH * 0.62 down, 64 points there). */
const RING = { x: 8, y: 20 } as const;
const KEY_MOVES: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
const KEY_DIR: Record<string, Dir> = { "0,-1": "back", "0,1": "front", "-1,0": "left", "1,0": "right" };
/** Inputs a person types into (a checkbox, a button or a slider is not one). */
const NOT_TEXT = /^(checkbox|radio|button|submit|reset|image|range|color|file)$/;
/** Widgets that keep the arrow keys and letters for themselves. */
const OWN_KEYS = '[role="menu"],[role="menubar"],[role="listbox"],[role="tablist"],[role="radiogroup"],[role="slider"],[role="tree"],[role="grid"],[role="spinbutton"],input[type="range"],input[type="radio"]';
function typingIn(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLInputElement) return !NOT_TEXT.test(el.type);
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return (el as HTMLElement).isContentEditable === true || !!el.closest('[role="textbox"],[role="combobox"],[role="searchbox"]');
}
/** The 3 x 5 letters of the key prompt's words. */
const GLYPH: Record<string, string[]> = {
  E: ["111", "100", "111", "100", "111"], S: ["011", "100", "010", "001", "110"], T: ["111", "010", "010", "010", "010"],
  A: ["010", "101", "111", "101", "101"], N: ["111", "101", "101", "101", "101"], D: ["110", "101", "101", "101", "110"],
};

/** The friends' window: the fire under the gallery, its armchairs, and a table for two either side (art pixels,
 * the window's shape). Where each friend sits, by the seat nearest each point. */
const FIRESIDE = { x: 316, y: 210, w: 300, h: 220 };
const FRIEND_SEATS = { maya: [329, 286], aisha: [376, 286], josh: [422, 265], sam: [579, 286], you: [511, 265] } as const;

/** The four friends of the "Study with friends" window, as they appear in its words. */
const FRIENDS = [
  { name: "Maya", look: 1 }, { name: "Aisha", look: 10 }, { name: "Josh", look: 3 }, { name: "Sam", look: 6 },
] as const;

/** Mounts the café on a canvas, with labels in `overlay`. Resolves once the art has loaded. */
export async function mountCafe(canvas: HTMLCanvasElement, overlay: HTMLElement, opts: CafeOptions): Promise<CafeHandle> {
  const A = await loadAssets();
  return new Cafe(canvas, overlay, A, opts);
}

/** Mounts the study app's Grand Library: this room with real people in it (see `LiveHooks`). */
export async function mountLibrary(canvas: HTMLCanvasElement, overlay: HTMLElement, opts: Omit<CafeOptions, "mode">): Promise<LibraryHandle> {
  const [A, W] = await Promise.all([loadAssets(true), import("@/lib/studyapp/library/walk")]);
  const handle = new Cafe(canvas, overlay, A, { ...opts, mode: "library" }, W) as unknown as LibraryHandle;
  // in development only (compiled out of a production build): the page's tests read where you stand through it
  if (process.env.NODE_ENV !== "production") (window as unknown as { __plumiLibrary?: LibraryHandle }).__plumiLibrary = handle;
  return handle;
}

class Cafe implements CafeHandle {
  private L: Layout;
  private spots: Spot[];
  private inkPaid = 0;
  private scene: HTMLCanvasElement;
  private sc: CanvasRenderingContext2D;
  private ctx: CanvasRenderingContext2D;
  private lamp: HTMLCanvasElement;
  private fire: HTMLCanvasElement | null;
  private people: Person[] = [];
  private you: Person | null = null;
  private t = 0;
  private raf = 0;
  private last = 0;
  private visible = true;
  private dead = false;
  private k = 1;
  private viewW = 0; private viewH = 0;
  private camX = 0; private camY = 0;
  private offX = 0; private offY = 0;
  private dpr = 1;
  private region: { x: number; y: number; w: number; h: number };
  /** Library mode, motion allowed: the library's own movement (a walk clock per person, a camera locked to you, a ground shadow, the frame governor). Else everything is as the homepage draws it. */
  private smooth: boolean;
  /** ... and while the governor allows 60 Hz, people also move by whole device pixels (`drawLive`); at 30 Hz the room is composed at art size and scaled up after, as before. */
  private get fine() { return this.smooth && this.hz60; }
  private lampFire: HTMLCanvasElement[] | null = null;
  private camFX = 0; private camFY = 0;     // smooth mode: the camera before it is put on the device pixel grid
  private followT = 0;                       // smooth mode: the room time of the last follow
  private camMoved = false;                  // smooth mode: the camera moved in the last follow
  private motion = false;                    // smooth mode: something in view moved in the last frame (so 60 Hz is worth it)
  private hz60 = true;                       // smooth mode: the frame governor's verdict
  private govWork = new Float32Array(GOV_WINDOW); private govSort = new Float32Array(GOV_WINDOW);
  private govLate = new Uint8Array(GOV_WINDOW);
  private govI = 0; private govN = 0; private govTick = 0; private lateI = 0; private lateSum = 0;
  private govAt = 0; private govFalls = 0; private govFrom = 0;
  private labels = new Map<Person, HTMLElement>();
  private widths = new WeakMap<HTMLElement, number>();
  /** Where each label was last put (whole CSS pixels) and how opaque: a label that has not moved is not written again. */
  private placed = new WeakMap<HTMLElement, { x: number; y: number; o: number }>();
  private items: DrawItem[] = [];          // this frame's, in draw order
  private itemPool: DrawItem[] = [];
  private itemN = 0;
  private stepBuf: Person[] = [];
  private vx0 = 0; private vy0 = 0; private vx1 = 0; private vy1 = 0;   // what is near the window this frame
  private pops: { el: HTMLElement; x: number; y: number; born: number }[] = [];
  private bubbles = new Map<Person, { el: HTMLElement; lift: number; timer: ReturnType<typeof setTimeout> }>();   // library mode: speech bubbles, one per person
  private looking: Person | null = null;        // library mode: the view is on them, not on you (lookAt)
  private timers: Person[] = [];
  private nextTimers = 0;
  private nextPop = 4;
  private nextArrival = 12;
  private seatedAt = 0;
  private lastStatus = "";
  private held: Dir | null = null;
  private hover: Person | null = null;          // under the mouse
  private picked: Person | null = null;         // tapped: their card stays until you tap elsewhere
  private card: HTMLElement | null = null;
  private cardFor: Person | null = null;
  private yourSubject: string | null = null;    // set when you pull up a chair beside someone
  private ghost = document.createElement("canvas");
  private cleanup: (() => void)[] = [];
  private cn: CafeClasses;
  private live: LiveHooks | undefined;
  private remotes = new Map<string, Person>();
  private libSeats: Set<Spot> | null = null;          // library mode: the chairs you and others may take
  private byIpad = new Map<number, Spot>();
  private ipadOf = new Map<Spot, number>();
  // library mode only: free movement, the seats' rings and the key prompt
  private grid: ReturnType<Walk["gridOf"]> | null = null;
  private ringSeats: Spot[] = [];                      // the chairs one can reach from the door: each shows a ring while free
  private keysDown = new Set<string>();
  private heading: [number, number] = [0, 0];          // the unit direction you are walking under the keys
  private lastYou = -1;                                // when your place was last announced (room time)
  private youOwed = false;                             // a step that has not been announced yet
  private hoverSeat: Spot | null = null;               // the free chair under the mouse
  private libArt: { rings: Record<"idle" | "near", HTMLCanvasElement[]>; key: HTMLCanvasElement; stand: HTMLCanvasElement } | null = null;
  private shown = "";                                  // what is on the canvas's data attributes
  private keyHints = false;                            // a keyboard is likely (a fine pointer): the key prompts show; on a phone or tablet the dock's buttons do the same
  private promptBox: [number, number, number, number] | null = null;   // where the key prompt was drawn, in art pixels
  looks: number;
  look = 0;

  constructor(private canvas: HTMLCanvasElement, private overlay: HTMLElement, private a: Assets, private o: CafeOptions, private W?: Walk) {
    this.L = a.L;
    this.spots = a.L.spots.map(s => ({ ...s, who: null }));
    this.cn = { ...LP_CLASSES, ...o.cls };
    this.live = o.mode === "library" ? o.live : undefined;
    if (this.W && !this.live) this.W = undefined;
    this.smooth = !!this.live && !o.reduced;
    if (this.W) this.grid = this.W.gridOf(this.L.walk, this.L.cols);
    if (this.W) this.keyHints = typeof matchMedia === "function" && !matchMedia("(pointer: coarse)").matches;
    if (this.live) this.libraryTable();
    this.looks = a.L.people.choose;
    this.scene = document.createElement("canvas");
    this.scene.width = this.L.w; this.scene.height = this.L.h;
    this.sc = this.scene.getContext("2d")!;
    this.ctx = canvas.getContext("2d")!;
    this.lamp = lightLayer(this.L, this.L.lights.filter(l => !l.fire));
    const fires = this.L.lights.filter(l => l.fire);
    this.fire = fires.length ? lightLayer(this.L, fires, .08) : null;
    this.region = o.mode === "friends" ? FIRESIDE : { x: 0, y: 0, w: this.L.w, h: this.L.h };
    this.populate();
    this.resize();
    this.bind();
    this.chooseTimers();
    this.draw();
    if (!o.reduced) this.start();
    this.status();
  }

  /* ---------- the cast ---------- */
  private person(look: number, x: number, y: number, dir: Dir = "front"): Person {
    const taken = new Set(this.people.map(p => p.who));
    return { look, x, y, dir, doing: "idle", path: [], spot: null, at: false, until: 0, next: null, phase: Math.floor(Math.random() * 6),
      stride: 0, still: 0, lx: x, ly: y, alpha: 1, who: pick(NAMES.filter(n => !taken.has(n))) ?? pick(NAMES), subject: pick(SUBJECTS), mins: Math.floor(rand(4, 48)),
      since: this.t - rand(0, 59), speed: rand(22, 28) };
  }

  private seatAt(p: Person, s: Spot, until: number) {
    s.who = p; p.spot = s; p.at = true; p.doing = s.role === "seat" || s.role === "sofa" ? "sit" : "stand";
    p.x = s.x + 8; p.y = s.y + 31; p.dir = s.face; p.until = until; p.path = [];
  }

  private free(role?: Spot["role"], inRegion = false) {
    return this.spots.filter(s => !s.who && (role ? s.role === role : s.role === "seat" || s.role === "sofa")
      && (!inRegion || this.inRegion(s.x + 8, s.y + 20)) && (role || this.canSit(s)));
  }

  private inRegion(x: number, y: number) {
    const r = this.region;
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  }

  private populate() {
    const L = this.L, n = L.people.looks;
    for (const s of this.spots.filter(x => x.role === "barista")) {
      const p = this.person(s.staff ? L.people.staff[s.staff] : n - 1, 0, 0, s.face);
      p.staff = s.staff;
      if (s.staff) p.who = STAFF[s.staff].name;
      this.seatAt(p, s, Infinity);
      this.people.push(p);
    }
    if (this.o.mode === "friends") {
      // Maya and Aisha across a table from each other, Josh in the armchair by the fire, Sam at the next table
      const seats = this.free("seat", true);
      const near = ([x, y]: readonly [number, number]) => [...seats].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      const F = FRIEND_SEATS;
      const plan: [typeof FRIENDS[number], Spot | undefined][] = [[FRIENDS[0], near(F.maya)], [FRIENDS[1], near(F.aisha)], [FRIENDS[2], near(F.josh)], [FRIENDS[3], near(F.sam)]];
      for (const [f, s] of plan) {
        if (!s) continue;
        const p = this.person(f.look, 0, 0);
        p.name = f.name; p.who = f.name;
        this.seatAt(p, s, Infinity);
        this.people.push(p);
      }
      // and you, in the other armchair across the fire from Josh, in your session (the window's chip)
      const yours = near(F.you), friendLooks: number[] = FRIENDS.map(f => f.look);
      const look = this.o.look !== undefined && this.o.look >= 0 && this.o.look < L.people.choose && !friendLooks.includes(this.o.look)
        ? this.o.look : [...Array(L.people.choose).keys()].find(l => !friendLooks.includes(l))!;
      this.look = look;
      if (yours && !yours.who) {
        const you = this.person(look, 0, 0);
        you.you = true; you.who = "You";
        this.seatAt(you, yours, Infinity);
        this.people.push(you);
        this.you = you;
        this.label(you, "You", this.cn.you);
      }
      const used = new Set(this.people.map(p => p.look));
      for (const s of this.free("seat", true).slice(0, 6)) {
        const look = [...Array(L.people.choose).keys()].find(l => !used.has(l));
        if (look === undefined) break;
        used.add(look);
        const p = this.person(look, 0, 0);
        this.seatAt(p, s, Infinity);
        this.people.push(p);
      }
      return;
    }
    // the visitor's look, then a full room: most seats taken, a few browsing the shelves
    const choose = L.people.choose;
    this.look = this.o.look !== undefined && this.o.look >= 0 && this.o.look < choose ? this.o.look : Math.floor(Math.random() * choose);
    if (this.o.mode === "hero") {
      for (const s of this.free().sort(() => Math.random() - .5).slice(0, this.crowd)) {
        const p = this.person(this.anyLook(), 0, 0);
        this.seatAt(p, s, this.t + rand(8, 90));
        this.people.push(p);
      }
      for (const s of this.free("browse").sort(() => Math.random() - .5).slice(0, 3)) {
        const p = this.person(this.anyLook(), 0, 0);
        this.seatAt(p, s, this.t + rand(3, 12));
        p.next = "seat";
        this.people.push(p);
      }
    }
    // the visitor comes in at the entrance and walks up the runner into the reading hall's middle aisle
    const d = L.door, you = this.person(this.look, d.x, d.y, "back");
    you.you = true; you.speed = this.live ? LIVE_SPEED : 36; you.who = "You";
    if (this.live && this.o.youSheet) { you.sheet = this.o.youSheet.sheet; you.sheetPhones = this.o.youSheet.phones; you.fw = wide(this.o.youSheet.frameW); }
    this.you = you;
    this.people.push(you);
    const inside = this.nearest(d.tile, d.x - 8, d.y - 150) ?? d.tile;
    if (this.o.reduced) {
      [you.x, you.y] = this.feet(inside);
    } else {
      you.doing = "enter"; you.alpha = 0;
      you.path = this.W
        ? [this.feet(d.tile), ...(this.W.plan(this.grid!, this.feet(d.tile), inside) ?? []).map(([x, y]) => [x, y] as [number, number])]
        : [this.feet(d.tile), ...(this.route(d.tile, inside) ?? []).map(t => this.feet(t))];
    }
    this.label(you, "You", this.cn.you);
  }

  /** How many students the room holds: most of its seats, a few left for the visitor. */
  /** Whether you are a person in this room, with a seat to take and a floor to walk: the hero, and the study app's library. */
  private get playable() { return this.o.mode === "hero" || this.o.mode === "library"; }

  private get crowd() {
    const seats = this.spots.filter(s => s.role === "seat" || s.role === "sofa").length;
    return Math.max(8, Math.round(seats * .6));
  }

  /** A look for a student: one nobody is wearing if there is one, never the visitor's. */
  private anyLook() {
    const n = this.L.people.looks - 2, used = new Set(this.people.map(p => p.look));
    const all = [...Array(n).keys()].filter(l => l !== this.look);
    const fresh = all.filter(l => !used.has(l));
    return pick(fresh.length ? fresh : all);
  }

  /* ---------- the floor ---------- */
  private walkable(tx: number, ty: number) {
    return tx >= 0 && ty >= 0 && tx < this.L.cols && ty < this.L.rows && this.L.walk[ty][tx] === ".";
  }
  private feet([tx, ty]: [number, number]): [number, number] { return [tx * this.L.tile + 8, ty * this.L.tile + 12]; }
  private tileOf(x: number, y: number): [number, number] {
    return [Math.floor(x / this.L.tile), Math.round((y - 12) / this.L.tile)];
  }

  /** Breadth-first over the 16 px grid; the tiles from `from` (exclusive) to `to`. */
  private route(from: [number, number], to: [number, number]): [number, number][] | null {
    const { cols, rows } = this.L, key = (x: number, y: number) => y * cols + x;
    const prev = new Int32Array(cols * rows).fill(-2);
    const q = [from];
    prev[key(...from)] = -1;
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      if (x === to[0] && y === to[1]) {
        const out: [number, number][] = [];
        let k = key(x, y);
        while (k !== key(...from)) { out.push([k % cols, Math.floor(k / cols)]); k = prev[k]; }
        return out.reverse();
      }
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]) {
        if (this.walkable(nx, ny) && prev[key(nx, ny)] === -2) { prev[key(nx, ny)] = key(x, y); q.push([nx, ny]); }
      }
    }
    return null;
  }

  /** The reachable tile nearest a point. */
  private nearest(from: [number, number], x: number, y: number): [number, number] | null {
    const { cols } = this.L, seen = new Set([from[1] * cols + from[0]]), q = [from];
    let best: [number, number] | null = null, bd = Infinity;
    for (let i = 0; i < q.length; i++) {
      const [tx, ty] = q[i], [fx, fy] = this.feet([tx, ty]), d = (fx - x) ** 2 + (fy - y) ** 2;
      if (d < bd) { bd = d; best = [tx, ty]; }
      for (const [nx, ny] of [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]] as [number, number][]) {
        if (this.walkable(nx, ny) && !seen.has(ny * cols + nx)) { seen.add(ny * cols + nx); q.push([nx, ny]); }
      }
    }
    return best;
  }

  /** Stand up (if sitting) and walk to a tile, then on to `end` (a seat's own place), if given. */
  private go(p: Person, tile: [number, number], end?: [number, number], dest?: [number, number]): boolean {
    if (p.at && p.spot) { p.x = this.feet(p.spot.tile)[0]; p.y = this.feet(p.spot.tile)[1]; p.at = false; }
    if (this.W) return this.goFree(p, tile, end, dest);
    const here = this.tileOf(p.x, p.y);
    const start: [number, number] = this.walkable(...here) ? here : this.nearestTile(p.x, p.y);
    const tiles = this.route(start, tile);
    if (!tiles) return false;
    p.path = [];
    const [sx, sy] = this.feet(start);
    if (Math.abs(sx - p.x) > 1 || Math.abs(sy - p.y) > 1) p.path.push([sx, sy]);
    p.path.push(...tiles.map(t => this.feet(t)));
    if (end) p.path.push(end);
    if (p.doing !== "enter" && p.doing !== "leave") p.doing = "walk";
    return true;
  }

  /** Library mode: an 8-connected route to a tile (and on to `dest`, a point in it), pulled into a few straight runs. */
  private goFree(p: Person, tile: [number, number], end?: [number, number], dest?: [number, number]): boolean {
    const path = this.W!.plan(this.grid!, [p.x, p.y], tile, dest);
    if (!path) return false;
    p.moving = false;
    p.path = path.map(([x, y]) => [x, y] as [number, number]);
    if (end) p.path.push(end);
    if (p.doing !== "enter" && p.doing !== "leave") p.doing = "walk";
    return true;
  }

  private nearestTile(x: number, y: number): [number, number] {
    let best: [number, number] = this.L.door.tile, bd = Infinity;
    for (let ty = 0; ty < this.L.rows; ty++) for (let tx = 0; tx < this.L.cols; tx++) {
      if (!this.walkable(tx, ty)) continue;
      const [fx, fy] = this.feet([tx, ty]), d = (fx - x) ** 2 + (fy - y) ** 2;
      if (d < bd) { bd = d; best = [tx, ty]; }
    }
    return best;
  }

  private release(p: Person) {
    if (p.spot && p.spot.who === p) p.spot.who = null;
    p.spot = null; p.at = false;
  }

  private sendTo(p: Person, s: Spot): boolean {
    this.release(p);
    s.who = p; p.spot = s;
    if (!this.go(p, s.tile, [s.x + 8, s.y + 31])) { this.release(p); return false; }
    return true;
  }

  /* ---------- the simulation ---------- */
  private step(dt: number) {
    this.t += dt;
    const t = this.t;
    // a copy, because remove() takes people out of the list as we go (kept, not made afresh every step)
    const people = this.stepBuf;
    people.length = 0;
    for (const q of this.people) people.push(q);
    for (const p of people) {
      if (p.remote && p.doing !== "leave" && p.alpha < 1) p.alpha = Math.min(1, p.alpha + dt * 2.5);
      if (this.W && p === this.you && this.keyStep(p, dt)) continue;
      if (p.path.length) this.walk(p, dt);
      else if (p.doing === "walk" || p.doing === "enter") this.arrive(p);
      else if (p.doing === "leave") {
        p.alpha -= dt * 2.5;
        if (p.alpha <= 0) this.remove(p);
      } else if (!p.you && !p.name && !p.remote && p.at && t >= p.until) this.decide(p);
    }
    if (this.smooth) this.clocks(dt);
    if (this.o.mode === "hero") {
      const students = this.people.filter(p => !p.you && !p.staff).length;
      if (students < this.crowd + 2 && t >= this.nextArrival) this.arrival();
      if (this.you?.at && (this.you.spot?.role === "seat" || this.you.spot?.role === "sofa")) {
        const minutes = Math.floor((t - this.seatedAt) / 60);
        if (minutes > this.inkPaid) { this.inkPaid = minutes; this.pop(this.you, "+1 ink"); }
      }
    }
    if (t >= this.nextTimers) this.chooseTimers();
    if (!this.live && t >= this.nextPop) {
      this.nextPop = t + rand(4, 8);
      const seated = this.people.filter(p => p.doing === "sit" && !p.you && !p.name && !this.labels.has(p) && this.onScreen(p) && !this.crowded(p, [...this.labels.keys()]));
      if (seated.length) this.pop(pick(seated), pick(POPS));
    }
    if (this.held && this.you && !this.you.path.length) this.nudge(this.held);
    if (this.youOwed && this.t - this.lastYou >= YOU_GAP) this.announce();
    this.status();
  }

  /**
   * Library mode: each person's own walk clock and stillness clock. A walk's poses are counted from the step it began
   * (so it always starts on the same pose, and every person and animal cycles at the same rate, not on a clock shared
   * by the room); someone who is put somewhere (or has stopped for a moment) holds one standing pose first.
   */
  private clocks(dt: number) {
    for (const p of this.people) {
      if (p.path.length > 0 || p.moving) { p.stride += dt; p.still = 0; }
      else { p.stride = 0; p.still = p.x !== p.lx || p.y !== p.ly ? 0 : p.still + dt; }
      p.lx = p.x; p.ly = p.y;
    }
  }

  private walk(p: Person, dt: number) {
    let left = p.speed * dt;
    while (left > 0 && p.path.length) {
      const [tx, ty] = p.path[0], dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > .01 || Math.abs(dy) > .01) p.dir = this.W ? this.W.facing(dx, dy, p.dir) : Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "front" : "back");
      if (d <= left) { p.x = tx; p.y = ty; p.path.shift(); left -= d; }
      else { p.x += dx / d * left; p.y += dy / d * left; left = 0; }
    }
    if (p.doing === "enter") p.alpha = Math.min(1, p.alpha + dt * 2.5);
  }

  private arrive(p: Person) {
    if (p.doing === "enter" && !p.spot) {
      p.doing = "idle";
      if (p.you) { this.nextTimers = Math.min(this.nextTimers, this.t + .5); this.youChanged(); return; }   // in view now: pick who to label
    }
    const s = p.spot;
    if (!s) { p.doing = "idle"; if (p.you) this.youChanged(); return; }
    const sit = s.role === "seat" || s.role === "sofa";
    p.at = true; p.doing = sit ? "sit" : "stand"; p.dir = s.face;
    p.x = s.x + 8; p.y = s.y + 31;
    if (p.you) { this.seatedAt = this.t; this.inkPaid = 0; this.nextTimers = Math.min(this.nextTimers, this.t + .5); this.youChanged(); return; }
    p.until = this.t + (sit ? rand(25, 70) : rand(5, 10));
    if (sit) { p.mins = Math.floor(rand(1, 20)); p.since = this.t; }
    if (sit) p.next = null;
  }

  private decide(p: Person) {
    this.unlabel(p);
    if (p.next === "seat" || p.doing === "stand") {
      const s = pick(this.free().filter(x => x.who === null));
      if (s && this.sendTo(p, s)) return;
      this.leave(p);
      return;
    }
    const r = Math.random(), crowd = this.people.filter(q => !q.you && !q.staff).length;
    if (r < .35 && crowd >= this.crowd - 4) { this.leave(p); return; }
    if (r < .75) {
      const s = pick([...this.free("queue"), ...this.free("browse")]);
      if (s && this.sendTo(p, s)) { p.next = "seat"; return; }
    }
    p.until = this.t + rand(15, 40);
  }

  private leave(p: Person) {
    this.release(p);
    const d = this.L.door;
    if (!this.go(p, d.tile, [d.x, d.y])) { this.remove(p); return; }
    p.doing = "leave";
    p.alpha = 1;
  }

  private remove(p: Person) {
    if (this.picked === p) this.picked = null;
    if (this.hover === p) this.hover = null;
    if (p.id) this.remotes.delete(p.id);
    this.release(p);
    this.people = this.people.filter(q => q !== p);
    this.labels.get(p)?.remove();
    this.labels.delete(p);
    this.timers = this.timers.filter(q => q !== p);
    this.nextArrival = Math.max(this.nextArrival, this.t + rand(3, 9));
  }

  /** "leave" shares its last leg with walking out: a leaver fades once they are through the door. */
  private arrival() {
    this.nextArrival = this.t + rand(4, 10);
    const d = this.L.door, p = this.person(this.anyLook(), d.x, d.y, "back");
    p.doing = "enter"; p.alpha = 0;
    const first = Math.random() < .5 ? this.free("queue")[0] : undefined;
    const s = first ?? pick(this.free());
    if (!s) return;
    s.who = p; p.spot = s; p.path = [this.feet(d.tile)];
    const tiles = this.route(d.tile, s.tile);
    if (!tiles) { s.who = null; return; }
    p.path.push(...tiles.map(t => this.feet(t)), [s.x + 8, s.y + 31]);
    if (first) p.next = "seat";
    this.people.push(p);
  }

  /* ---------- the visitor ---------- */
  private nudge(dir: Dir) {
    const you = this.you;
    if (!you || you.doing === "enter") return;
    if (you.at) { this.release(you); you.at = false; you.doing = "idle"; const [x, y] = this.feet(this.nearestTile(you.x, you.y)); you.x = x; you.y = y; }
    const [tx, ty] = this.tileOf(you.x, you.y);
    const [dx, dy] = dir === "right" ? [1, 0] : dir === "left" ? [-1, 0] : dir === "back" ? [0, -1] : [0, 1];
    you.dir = dir;
    if (this.walkable(tx + dx, ty + dy)) { you.path = [this.feet([tx + dx, ty + dy])]; you.doing = "walk"; }
    this.youChanged();
  }

  private sitNearby() {
    const you = this.you;
    if (!you || you.at) return;
    if (this.W) { const s = this.nearSeat(); if (s) this.takeSeat(you, s); return; }
    const [tx, ty] = this.tileOf(you.x, you.y);
    const s = this.free().find(x => x.tile[0] === tx && x.tile[1] === ty);
    if (s && this.sendTo(you, s)) this.youChanged();
  }

  /** The person drawn at an art pixel, the frontmost first. */
  private hit(ax: number, ay: number): Person | null {
    return [...this.people].sort((a, b) => this.z(b) - this.z(a)).find(p => {
      const [x, y] = this.spriteAt(p), tall = p.at && p.spot?.pose === "stool" ? 20 : 32;
      const fw = p.fw ?? 16, pad = p.fw ? Math.max(1, (fw - 22) / 2) : 2;      // a wide frame (the fox's) has empty columns at the sides: its body is the middle 22
      return ax >= x + pad && ax < x + fw - pad && ay >= y + 4 && ay < y + tall && p.alpha > .5;
    }) ?? null;
  }

  private tap(ax: number, ay: number) {
    const hit = this.hit(ax, ay);
    if (hit && !hit.you) {
      if (this.live && !hit.remote) { this.draw(); return; }               // the librarian and the butler are part of the room
      this.picked = this.picked === hit ? null : hit;
      if (this.o.mode === "friends") this.pop(hit, "High five!");
      this.live?.onPick?.(this.picked?.id ?? null);
      this.draw();
      return;
    }
    if (this.picked) this.live?.onPick?.(null);
    this.picked = null;
    const you = this.you;
    if (!you || !this.playable) { this.draw(); return; }
    this.yourSubject = null;
    // a free seat?
    const seat = this.W ? this.seatAt_(ax, ay) : this.spots.find(s => (s.role === "seat" || s.role === "sofa") && this.canSit(s) && ax >= s.x - 3 && ax < s.x + 19 && ay >= s.y + 4 && ay < s.y + 36);
    if (seat && (!seat.who || seat.who === you)) {
      if (seat.who === you && you.at) return;
      if (this.o.reduced) { this.release(you); this.seatAt(you, seat, Infinity); this.seatedAt = this.t; this.draw(); this.status(); this.youChanged(); return; }
      if (this.sendTo(you, seat)) this.youChanged();
      return;
    }
    const from = this.walkable(...this.tileOf(you.x, you.y)) ? this.tileOf(you.x, you.y) : this.nearestTile(you.x, you.y);
    const to = this.W ? this.W.nearestTile(this.grid!, from, ax, ay) as [number, number] | null : this.nearest(from, ax, ay);
    if (!to) return;
    if (this.o.reduced) {
      this.release(you); you.doing = "idle";
      [you.x, you.y] = this.feet(to);
      this.draw(); this.status(); this.youChanged();
      return;
    }
    this.release(you);
    if (this.W) {
      // the feet land where the tap did, when that is floor in the tile reached; else the tile's middle
      const c = this.W.cellOf(ax, ay);
      this.go(you, to, undefined, c[0] === to[0] && c[1] === to[1] ? [ax, ay] : undefined);
    } else this.go(you, to);
    this.youChanged();
  }

  /** Sit at the free seat nearest someone and study what they're studying (the app's "Pull up a chair"). */
  private joinPerson(p: Person) {
    const you = this.you;
    if (!you) return;
    const [px, py] = this.spriteAt(p);
    const seat = this.free().filter(s => !s.who || s.who === you)
      .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
    if (!seat) return;
    this.picked = null;
    this.yourSubject = p.subject;
    if (this.o.reduced) { this.release(you); this.seatAt(you, seat, Infinity); this.seatedAt = this.t; this.draw(); this.status(); this.youChanged(); return; }
    if (!this.sendTo(you, seat)) this.yourSubject = null;
    else this.youChanged();
  }

  /** The card over whoever is pointed at or tapped: their name, their subject and how long they've been at it. */
  private cardText(p: Person): { title: string; subject: string | null; line: string; join: boolean } {
    if (p.staff) return { title: p.who, subject: null, line: STAFF[p.staff].line, join: false };
    const sitting = p.at && (p.spot?.role === "seat" || p.spot?.role === "sofa");
    if (sitting) {
      const secs = Math.max(0, Math.floor(p.mins * 60 + this.t - p.since)), m = Math.floor(secs / 60);
      const time = m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m}:${String(secs % 60).padStart(2, "0")}`;
      return { title: p.who, subject: p.subject, line: `⏱ ${time} focused`, join: this.o.mode === "hero" };
    }
    const line = p.doing === "leave" ? "Heading home" : p.at && p.spot?.role === "browse" ? "Browsing the shelves"
      : p.doing === "enter" ? "Just arrived" : "Finding a seat";
    return { title: p.who, subject: null, line, join: false };
  }

  private showCard() {
    if (this.live) { if (this.card) { this.card.remove(); this.card = null; this.cardFor = null; } return; }   // the page shows the card
    const p = this.picked ?? this.hover;
    if (!p || p.you || p.alpha <= .5) {
      if (this.card) { this.card.remove(); this.card = null; this.cardFor = null; }
      return;
    }
    let el = this.card;
    if (!el) {
      el = document.createElement("div");
      el.className = "lp-who";
      el.innerHTML = '<b></b><span class="lp-who-sub"></span><span class="lp-who-line"></span><button type="button" class="lp-who-join">Pull up a chair ›</button>';
      el.querySelector("button")!.addEventListener("click", e => { e.stopPropagation(); if (this.cardFor) this.joinPerson(this.cardFor); });
      this.overlay.appendChild(el);
      this.card = el;
    }
    const c = this.cardText(p);
    const [b, sub, line, join] = [el.querySelector("b")!, el.querySelector<HTMLElement>(".lp-who-sub")!, el.querySelector<HTMLElement>(".lp-who-line")!, el.querySelector<HTMLElement>("button")!];
    if (b.textContent !== c.title) b.textContent = c.title;
    sub.hidden = !c.subject;
    if (c.subject && sub.textContent !== c.subject) { sub.textContent = c.subject; sub.style.background = SUBJECT_COLOURS[c.subject] ?? "#fff"; }
    if (line.textContent !== c.line) line.textContent = c.line;
    join.hidden = !c.join || this.picked !== p;
    el.classList.toggle("is-picked", this.picked === p);
    if (this.cardFor !== p) { this.cardFor = p; this.widths.set(el, el.offsetWidth); }
  }

  setLook(look: number) {
    if (!this.you || look < 0 || look >= this.L.people.choose) return;
    const other = this.people.find(p => p !== this.you && p.look === look);
    if (other) other.look = this.you.look;
    this.you.look = look; this.look = look;
    this.draw();
    this.status(true);
  }

  private status(force = false) {
    const you = this.you;
    if (!you || !this.o.onStatus) return;
    const seated = you.at && !!you.spot;
    const s: CafeStatus = { seated, seconds: seated ? Math.floor(this.t - this.seatedAt) : 0, look: you.look, subject: seated ? this.yourSubject : null };
    const key = `${s.seated}|${s.seconds}|${s.look}|${s.subject}`;
    if (key !== this.lastStatus || force) { this.lastStatus = key; this.o.onStatus(s); }
  }

  /* ---------- labels ---------- */
  private label(p: Person, text: string, cls = this.cn.nm) {
    let el = this.labels.get(p);
    if (!el) { el = document.createElement("div"); this.overlay.appendChild(el); this.labels.set(p, el); }
    if (el.className !== cls || el.textContent !== text) {
      el.className = cls;
      el.textContent = text;
      this.widths.set(el, el.offsetWidth);
    }
    return el;
  }

  private timerText(p: Person) { return `${p.subject} · ${p.mins + Math.floor((this.t - p.since) / 60)} min`; }

  private unlabel(p: Person) {
    if (p.name || p.you) return;
    this.labels.get(p)?.remove();
    this.labels.delete(p);
    this.timers = this.timers.filter(q => q !== p);
  }

  private chooseTimers() {
    if (this.live) { this.nextTimers = this.t + 1; this.libraryLabels(); return; }
    this.nextTimers = this.t + rand(9, 14);
    for (const p of this.timers) if (!p.name && !p.you) { this.labels.get(p)?.remove(); this.labels.delete(p); }
    this.timers = [];
    if (this.o.mode === "friends") {
      for (const p of this.people) if (p.name) this.label(p, p.name);
      return;
    }
    const seated = this.people.filter(p => p.doing === "sit" && !p.you && this.onScreen(p)).sort(() => Math.random() - .5);
    const max = this.overlay.clientWidth < 480 ? 2 : 3;
    for (const p of seated) {
      if (this.timers.length >= max) break;
      if (this.crowded(p, [...this.timers, ...(this.you ? [this.you] : [])])) continue;
      if (this.timers.some(q => q.subject === p.subject)) p.subject = SUBJECTS.find(x => !this.timers.some(q => q.subject === x)) ?? p.subject;
      this.timers.push(p);
      this.label(p, this.timerText(p), this.cn.timer);
    }
  }

  /** Whether a label over `p` would run into the labels over any of `others` (measured on screen). */
  private crowded(p: Person, others: Person[]) {
    const s = this.k / this.dpr, [x, y] = this.spriteAt(p);
    return others.some(q => {
      if (q === p) return false;
      const [qx, qy] = this.spriteAt(q);
      return Math.abs(qx - x) * s < 130 && Math.abs(qy - y) * s < 30;
    });
  }

  private show(p: Person) {
    if (this.timers.includes(p)) return;
    this.timers.push(p);
    this.label(p, this.timerText(p), this.cn.timer);
  }

  private pop(p: Person, text: string) {
    const el = document.createElement("div");
    el.className = this.cn.pop + (text.startsWith("✓") ? " " + this.cn.tick : text.startsWith("+") ? " " + this.cn.ink : "");
    el.textContent = text;
    this.overlay.appendChild(el);
    this.widths.set(el, el.offsetWidth);
    const [x, y] = this.spriteAt(p);
    const labelled = this.labels.has(p);
    this.pops.push({ el, x: x + this.half(p), y: y + (labelled ? -8 : 4), born: this.t });
    setTimeout(() => { el.remove(); this.pops = this.pops.filter(q => q.el !== el); }, 1700);
    this.place();
  }

  private onScreen(p: Person) {
    const [x, y] = this.spriteAt(p);
    const m = x + this.half(p);
    return m >= this.camX + 24 && m < this.camX + this.viewW - 24 && y >= this.camY + 8 && y + 20 < this.camY + this.viewH;
  }

  /** Puts a label or pop at an art-pixel spot, in CSS pixels over the canvas; it never runs off the window. Writes nothing if it is where it was. */
  private putAt(el: HTMLElement, x: number, y: number, s: number, ow: number) {
    let px = (x - this.camX) * s + this.offX / this.dpr, py = (y - this.camY) * s + this.offY / this.dpr;
    const half = (this.widths.get(el) ?? 0) / 2;
    if (half) px = Math.min(Math.max(px, half + 4), ow - half - 4);   // a label never runs off the window
    py = Math.max(py, 24);
    // in the library a label lands on the device pixel grid, the same one its person is drawn on, so it follows them exactly
    const d = this.smooth && this.hz60 ? this.dpr : 1;
    const rx = Math.round(px * d) / d, ry = Math.round(py * d) / d;
    let c = this.placed.get(el);
    if (!c) { c = { x: NaN, y: NaN, o: NaN }; this.placed.set(el, c); }
    if (c.x !== rx || c.y !== ry) { c.x = rx; c.y = ry; el.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -100%)`; }
  }

  /** Where each label sits: over its person's head, in CSS pixels over the canvas. */
  private place() {
    const s = this.k / this.dpr;
    const ow = this.overlay.clientWidth;
    this.showCard();
    for (const [p, el] of this.labels) {
      this.putAt(el, this.spriteX(p) + this.half(p), this.spriteY(p) + this.crown(p), s, ow);
      const o = this.card && this.cardFor === p ? 0 : this.W && this.tagOnPrompt(p, el) ? 0 : p.alpha;
      const c = this.placed.get(el)!;
      if (c.o !== o) { c.o = o; el.style.opacity = String(o); }
    }
    for (const q of this.pops) this.putAt(q.el, q.x, q.y, s, ow);
    for (const [p, b] of this.bubbles) {
      this.putAt(b.el, this.spriteX(p) + this.half(p), this.spriteY(p) + (this.labels.has(p) ? -24 : -2) - b.lift * 34, s, ow);
      const o = p.alpha > .3 ? "" : "0";
      if (b.el.style.opacity !== o) b.el.style.opacity = o;
    }
    if (this.card && this.cardFor) {
      // over their head, or under their feet when there isn't room above
      const [x, y] = this.spriteAt(this.cardFor), el = this.card, half = el.offsetWidth / 2;
      const px = Math.min(Math.max((x + this.half(this.cardFor) - this.camX) * s + this.offX / this.dpr, half + 4), ow - half - 4);
      const above = (y + 3 - this.camY) * s + this.offY / this.dpr;
      const below = (y + 32 - this.camY) * s + this.offY / this.dpr + 10;
      el.style.transform = above - el.offsetHeight >= 4
        ? `translate(${Math.round(px)}px, ${Math.round(above)}px) translate(-50%, -100%)`
        : `translate(${Math.round(px)}px, ${Math.round(below)}px) translate(-50%, 0)`;
    }
  }

  /* ---------- drawing ---------- */
  /** The top left of the frame drawn for a person. A frame wider than the people's 16 (an animal's) is centred on the same feet, so it starts further left. */
  private spriteAt(p: Person): [number, number] {
    return [this.spriteX(p), this.spriteY(p)];
  }
  /** `spriteAt`, one number at a time, for the frame loop (no array made). */
  private spriteX(p: Person): number {
    const sh = p.fw ? (p.fw - 16) / 2 : 0;
    return (p.at && p.spot ? p.spot.x : this.snap(p.x) - 8) - sh;
  }
  private spriteY(p: Person): number { return p.at && p.spot ? p.spot.y : this.snap(p.y) - 31; }
  /** Where a walker is drawn along one axis: a whole art pixel on the homepage; in the library a whole device pixel (a fraction 1 / k of an art pixel). */
  private snap(v: number): number { return this.smooth && this.hz60 ? Math.round(v * this.k) / this.k : Math.round(v); }

  /** Half a frame: where the feet are across the frame (8 for a person). */
  private half(p: Person) { return p.fw ? p.fw / 2 : 8; }
  /** Where the name tag meets the sprite: just above a person's head, an animal's ears are higher. */
  private crown(p: Person) { return p.fw ? 2 : 5; }

  private z(p: Person) { return p.at && p.spot ? p.spot.sort : p.y; }

  private frame(p: Person, tick: number): number {
    const R = this.L.people.rows, d = DIRS.indexOf(p.dir);
    if (p.path.length || p.moving) return R.walk + d * 6 + (this.smooth ? Math.floor(p.stride * POSE_HZ) % 6 : (Math.floor(tick / 2) + p.phase) % 6);
    if (p.at && p.spot) {
      const s = p.spot;
      if (s.pose === "sit") return R.sit + (s.face === "right" ? 0 : 6) + (Math.floor(tick / 8) + p.phase) % 6;
      if (s.pose === "read") return R.read + (Math.floor(tick / 5) + p.phase) % 6;
      if (s.pose === "phone") return R.phone + (Math.floor(tick / 4) + p.phase) % 6;
      return R.idle + DIRS.indexOf(s.face) * 6 + (Math.floor(tick / 6) + p.phase) % 6;
    }
    if (this.smooth) return R.idle + d * 6 + Math.floor(Math.max(0, p.still - STILL_FIRST) * this.L.fps / 6) % 6;
    return R.idle + d * 6 + (Math.floor(tick / 6) + p.phase) % 6;
  }

  /** The next free item in this frame's list (from the pool), at depth `z`. */
  private item(z: number, kind: DrawItem["kind"]): DrawItem {
    const pool = this.itemPool;
    let it = pool[this.itemN];
    if (!it) { it = { z: 0, kind, an: null, pc: null, p: null, img: null, x: 0, y: 0, f: 0, sy: 0, fx: 0, fy: 0, outline: false, shadow: false }; pool.push(it); }
    this.itemN++;
    it.z = z; it.kind = kind;
    this.items.push(it);
    return it;
  }

  private near(x: number, y: number, w: number, h: number) { return x < this.vx1 && x + w > this.vx0 && y < this.vy1 && y + h > this.vy0; }

  private drawItem(it: DrawItem) {
    const { sc, a } = this;
    switch (it.kind) {
      case 1: { const an = it.an!; sc.drawImage(a.anims, it.fx, it.fy, an.w, an.h, an.x, an.y, an.w, an.h); break; }
      case 2: { const pc = it.pc!; sc.drawImage(a.pieces, pc.ax, pc.ay, pc.w, pc.h, pc.x, pc.y, pc.w, pc.h); break; }
      case 3: {
        const img = it.img!, fw = it.p!.fw ?? 16;
        if (it.shadow) {
          sc.globalAlpha = SHADOW_ALPHA * it.p!.alpha;
          sc.fillStyle = SHADOW_RGB;
          for (let r = 0; r < SHADOW_ROWS.length; r++) sc.fillRect(it.x + fw / 2 - SHADOW_ROWS[r] / 2, it.y + 31 - SHADOW_ROWS.length + 1 + r, SHADOW_ROWS[r], 1);
        }
        if (it.outline) this.outline(it.f, img, it.sy, it.x, it.y, fw);
        sc.globalAlpha = it.p!.alpha;
        sc.drawImage(img, it.f * fw, it.sy, fw, 32, it.x, it.y, fw, 32);
        sc.globalAlpha = 1;
        break;
      }
      default: sc.drawImage(it.img!, it.x, it.y);
    }
  }

  private draw() {
    if (this.smooth && this.hz60) { this.drawLive(); return; }
    const { L, sc, a } = this;
    const tick = Math.floor(this.t * L.fps);
    sc.globalAlpha = 1;
    sc.drawImage(a.bg, 0, 0);
    const items = this.items;
    items.length = 0;
    this.itemN = 0;
    // only what is near the window: the library is several windows wide
    const m = 64;
    this.vx0 = this.camX - m; this.vy0 = this.camY - m; this.vx1 = this.camX + this.viewW + m; this.vy1 = this.camY + this.viewH + m;
    for (const an of L.anims) {
      if (!this.near(an.x, an.y, an.w, an.h)) continue;
      const [fx, fy] = an.frames[an.seq[tick % an.seq.length]];
      if (an.z === 0) { sc.drawImage(a.anims, fx, fy, an.w, an.h, an.x, an.y, an.w, an.h); continue; }
      const it = this.item(an.z, 1);
      it.an = an; it.fx = fx; it.fy = fy;
    }
    for (const pc of L.pieces) if (this.near(pc.x, pc.y, pc.w, pc.h)) { const it = this.item(pc.z, 2); it.pc = pc; }
    const lit = this.picked ?? this.hover;
    for (const p of this.people) {
      if (p.alpha <= 0) continue;
      const x = this.spriteX(p), y = this.spriteY(p), f = this.frame(p, tick);
      if (!this.near(x, y, p.fw ?? 16, 32)) continue;
      const it = this.item(this.z(p) + .01, 3);
      it.p = p; it.x = x; it.y = y; it.f = f;
      it.img = p.sheet ?? a.people; it.sy = p.sheet ? 0 : p.look * 32;
      it.outline = p === lit && !p.you;
      it.shadow = this.smooth && this.grounded(p);
    }
    if (this.W) this.addRings(tick);
    items.sort(byDepth);
    for (let i = 0; i < items.length; i++) this.drawItem(items[i]);
    sc.drawImage(this.lamp, 0, 0);
    if (this.fire) { sc.globalAlpha = (.30 + .04 * (Math.floor(tick / 3) % 3)) / .38; sc.drawImage(this.fire, 0, 0); sc.globalAlpha = 1; }
    if (!this.o.reduced) this.notes(tick);
    if (this.W) this.drawPrompt(tick);
    // to the screen, by whole pixels
    const { ctx, canvas } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#2a1d1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.follow(this.o.reduced);
    ctx.drawImage(this.scene, this.camX, this.camY, this.viewW, this.viewH, this.offX, this.offY, this.viewW * this.k, this.viewH * this.k);
    this.place();
  }

  /**
   * The library's frame (the homepage's `draw` is above, and unchanged). The same order as the kit's, but composed
   * straight onto the screen canvas at its own resolution instead of into the art sized `scene` and scaled up after:
   * the room, then everything that stands on the floor in order of depth, then the lamplight. Everything is still
   * made of whole art pixels, k device pixels square, drawn nearest neighbour at integer sizes. What changes is where a
   * walker may stand: the ground, the pieces and the lamp sit on the art grid (camera, pieces and animations at whole
   * art pixels), a person's sprite and shadow at the nearest device pixel, a 1/k art pixel step. A table, plant or
   * chair that stands in front of a walker is drawn after them, at the same scale and offset, so it covers them exactly.
   */
  private drawLive() {
    const { L, a, ctx, canvas, k } = this;
    const tick = Math.floor(this.t * L.fps);
    this.follow(false);                                   // the camera first: every place below is relative to it
    const view = this.viewW * k, tall = this.viewH * k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    if (view < canvas.width - .5 || tall < canvas.height - .5) { ctx.fillStyle = "#2a1d1a"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(a.bg, this.camX, this.camY, this.viewW, this.viewH, this.offX, this.offY, view, tall);
    // art pixel coordinates from here on: one art pixel is k device pixels, the origin on the device pixel grid
    const tx = this.offX - Math.round(this.camX * k), ty = this.offY - Math.round(this.camY * k);
    ctx.setTransform(k, 0, 0, k, tx, ty);
    const items = this.items;
    items.length = 0;
    this.itemN = 0;
    let motion = this.camMoved;
    const m = 64;
    this.vx0 = this.camX - m; this.vy0 = this.camY - m; this.vx1 = this.camX + this.viewW + m; this.vy1 = this.camY + this.viewH + m;
    for (const an of L.anims) {
      if (!this.near(an.x, an.y, an.w, an.h)) continue;
      const [fx, fy] = an.frames[an.seq[tick % an.seq.length]];
      if (an.z === 0) { ctx.drawImage(a.anims, fx, fy, an.w, an.h, an.x, an.y, an.w, an.h); continue; }
      const it = this.item(an.z, 1);
      it.an = an; it.fx = fx; it.fy = fy;
    }
    for (const pc of L.pieces) if (this.near(pc.x, pc.y, pc.w, pc.h)) { const it = this.item(pc.z, 2); it.pc = pc; }
    const lit = this.picked ?? this.hover;
    for (const p of this.people) {
      if (p.alpha <= 0) continue;
      const x = this.spriteX(p), y = this.spriteY(p);
      if (!this.near(x, y, p.fw ?? 16, 32)) continue;
      const walking = p.path.length > 0 || !!p.moving;
      if (walking) motion = true;
      const it = this.item(this.z(p) + .01, 3);
      it.p = p; it.x = x; it.y = y; it.f = this.frame(p, tick);
      it.img = p.sheet ?? a.people; it.sy = p.sheet ? 0 : p.look * 32;
      it.outline = p === lit && !p.you;
      it.shadow = this.grounded(p);
    }
    this.motion = motion;
    this.addRings(tick);
    items.sort(byDepth);
    for (let i = 0; i < items.length; i++) this.drawItemLive(items[i], tx, ty);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // the lamplight and the fire's flicker in one layer (made once per flicker step): one blend over the screen, not two
    ctx.drawImage(this.lampLayer(tick), this.camX, this.camY, this.viewW, this.viewH, this.offX, this.offY, view, tall);
    ctx.setTransform(k, 0, 0, k, tx, ty);
    this.notes(tick, ctx);
    this.drawPrompt(tick, ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.place();
  }

  /** The lamplight with the fire's light over it, for this tick's flicker step (made on first use); the same as drawing the two in turn. */
  private lampLayer(tick: number): HTMLCanvasElement {
    if (!this.fire) return this.lamp;
    const all = (this.lampFire ??= [0, 1, 2].map(j => {
      const cv = document.createElement("canvas");
      cv.width = this.L.w; cv.height = this.L.h;
      const c = cv.getContext("2d")!;
      c.drawImage(this.lamp, 0, 0);
      c.globalAlpha = (.30 + .04 * j) / .38;
      c.drawImage(this.fire!, 0, 0);
      return cv;
    }));
    return all[Math.floor(tick / 3) % 3];
  }

  /** Whether a person stands on the floor (a shadow under them): not one in a chair or on a stool. */
  private grounded(p: Person): boolean {
    return !(p.at && p.spot && (p.doing === "sit" || p.spot.pose === "sit" || p.spot.pose === "stool"));
  }

  /** One item of `drawLive`, with the origin of art pixel space at (tx, ty) device pixels. A person is placed in device pixels (their shadow, outline and sprite all at the same one). */
  private drawItemLive(it: DrawItem, tx: number, ty: number) {
    const { ctx, a, k } = this;
    switch (it.kind) {
      case 1: { const an = it.an!; ctx.drawImage(a.anims, it.fx, it.fy, an.w, an.h, an.x, an.y, an.w, an.h); break; }
      case 2: { const pc = it.pc!; ctx.drawImage(a.pieces, pc.ax, pc.ay, pc.w, pc.h, pc.x, pc.y, pc.w, pc.h); break; }
      case 3: {
        const p = it.p!, img = it.img!, fw = p.fw ?? 16;
        const dx = Math.round(it.x * k) + tx, dy = Math.round(it.y * k) + ty;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (it.shadow) {
          // under the feet whichever way they face and whatever the pose: stepped rows, no smoothing, half opaque
          ctx.globalAlpha = SHADOW_ALPHA * p.alpha;
          ctx.fillStyle = SHADOW_RGB;
          const mid = dx + fw * k / 2, top = dy + (31 - SHADOW_ROWS.length + 1) * k;
          for (let r = 0; r < SHADOW_ROWS.length; r++) { const w = SHADOW_ROWS[r] * k; ctx.fillRect(mid - w / 2, top + r * k, w, k); }
        }
        if (it.outline) {
          ctx.globalAlpha = 1;
          const g = this.silhouette(it.f, img, it.sy, fw);
          for (const [ox, oy] of OUTLINE) ctx.drawImage(g, 0, 0, fw, 32, dx + ox * k, dy + oy * k, fw * k, 32 * k);
        }
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(img, it.f * fw, it.sy, fw, 32, dx, dy, fw * k, 32 * k);
        ctx.globalAlpha = 1;
        ctx.setTransform(k, 0, 0, k, tx, ty);
        break;
      }
      default: ctx.drawImage(it.img!, it.x, it.y);
    }
  }

  /** A one-pixel white outline round a person: their frame as a white silhouette, drawn a pixel each way. */
  private outline(f: number, img: CanvasImageSource, sy: number, x: number, y: number, fw = 16) {
    const g = this.silhouette(f, img, sy, fw);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.sc.drawImage(g, x + dx, y + dy);
  }

  /** A person's frame as a white silhouette (in `ghost`). */
  private silhouette(f: number, img: CanvasImageSource, sy: number, fw: number): HTMLCanvasElement {
    const g = this.ghost, gc = g.getContext("2d")!;
    if (g.width !== fw) { g.width = fw; g.height = 32; }
    gc.globalCompositeOperation = "source-over";
    gc.clearRect(0, 0, fw, 32);
    gc.drawImage(img, f * fw, sy, fw, 32, 0, 0, fw, 32);
    gc.globalCompositeOperation = "source-in";
    gc.fillStyle = "#fff";
    gc.fillRect(0, 0, fw, 32);
    return g;
  }

  /** The kit's music notes, rising from the headphones of a few who are sitting. */
  private notes(tick: number, sc = this.sc) {
    const phones = this.L.people.phones;
    let i = 0;
    for (const p of this.people) {
      if (p.doing !== "sit" || !(p.sheet ? p.sheetPhones : phones[p.look]) || p.you) continue;
      const ph = (tick + i * 23 + p.phase * 7) % 90;
      i++;
      if (ph >= 30) continue;
      const k = 1 - Math.max(0, ph - 20) / 10, x = this.spriteX(p), y = this.spriteY(p);
      sc.globalAlpha = .9 * k;
      sc.fillStyle = NOTE_COLS[i % 4];
      for (const [nx, ny] of NOTE) sc.fillRect(x + 12 + (Math.floor(ph / 6) % 2) + nx, y + 2 - Math.floor(ph / 2) + ny, 1, 1);
    }
    sc.globalAlpha = 1;
  }

  /* ---------- the view: whole pixels, following the visitor ---------- */
  private resize() {
    const box = this.canvas.getBoundingClientRect();
    if (!box.width) return;
    let dpr = Math.min(3, window.devicePixelRatio || 1);
    let W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
    const r = this.region;
    // the hero is a window onto part of the library, at the size the café was drawn at, that follows you about
    const want = this.playable ? (box.width < 560 ? 240 : 400) : r.w;
    const exact = W / want;
    let k = Math.max(1, Math.round(exact));
    if (W / k > r.w * 1.04 || H / k > (this.playable ? this.L.h : r.h) * 1.04) k = Math.ceil(exact);
    if ((k - exact) / exact > .3 && dpr < 2) k = exact;                // a large crop on a low-density screen: fit instead
    // The study app's room is a full window: 2560 x 1440 at 3x is 33 million pixels to clear and scale every frame. Past
    // the budget, fewer device pixels go to each art pixel (k) and the density drops to match, so an art pixel is the
    // same size on screen and the view shows the same room, only on a smaller canvas the browser scales the last bit.
    if (this.o.mode === "library" && W * H > LIBRARY_PIXELS) {
      const k2 = Math.max(1, Math.floor(k * Math.sqrt(LIBRARY_PIXELS / (W * H))));
      if (k2 < k) { dpr = dpr * k2 / k; W = Math.round(box.width * dpr); H = Math.round(box.height * dpr); k = k2; }
    }
    this.dpr = dpr;
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    this.k = k;
    this.viewW = Math.min(this.L.w, W / k);
    this.viewH = Math.min(this.L.h, H / k);
    this.offX = Math.max(0, Math.round((W - this.viewW * k) / 2));
    this.offY = Math.max(0, Math.round((H - this.viewH * k) / 2));
    this.follow(true);
  }

  private follow(snap = false) {
    let cx: number, cy: number, lock = false;
    if (this.playable && this.you && this.viewW < this.L.w - 1) {
      // a little ahead of you, up into the room: the entrance is at the bottom and the library opens out above it
      const [x, y] = this.looking ? this.spriteAt(this.looking) : this.spriteAt(this.you);
      cx = x + this.half(this.looking ?? this.you); cy = y + 18 - (this.looking ? 0 : this.viewH * .2);
      // library: while you walk the view is held to you (a look at someone, the entrance and a seat taken ease instead)
      lock = !this.looking && this.you.doing !== "enter" && (!!this.you.moving || this.you.path.length > 0);
    } else {
      cx = this.region.x + this.region.w / 2; cy = this.region.y + this.region.h / 2;
    }
    const tx = Math.min(Math.max(cx - this.viewW / 2, 0), this.L.w - this.viewW);
    const ty = Math.min(Math.max(cy - this.viewH / 2, 0), this.L.h - this.viewH);
    if (this.smooth) { this.followLive(tx, ty, snap, lock); return; }
    if (snap) { this.camX = tx; this.camY = ty; }
    else { this.camX += (tx - this.camX) * .12; this.camY += (ty - this.camY) * .12; }
    // land the camera on whole art pixels, so every pixel stays the same size
    this.camX = Math.round(this.camX * this.k) / this.k;
    this.camY = Math.round(this.camY * this.k) / this.k;
  }

  /**
   * The library's camera. While you walk it is locked to you: it lands on the same device pixel grid as your sprite
   * the same frame, so you do not slide against the window and it stops the frame you do. It catches up at a speed
   * (not an ease) when it was somewhere else, so it never trails and never overshoots. Everything else (a look at
   * someone, sitting, standing, the entrance) eases, by time and not by frame so 60 and 30 Hz agree, and the ease is
   * kept in floats and only the picture of it is put on the grid, so it arrives exactly.
   */
  private followLive(tx: number, ty: number, snap: boolean, lock: boolean) {
    const dt = Math.min(.25, Math.max(0, this.t - this.followT));
    this.followT = this.t;
    if (snap) { this.camFX = tx; this.camFY = ty; }
    else if (lock) {
      const m = CATCH_UP * dt, dx = tx - this.camFX, dy = ty - this.camFY;
      this.camFX += dx > m ? m : dx < -m ? -m : dx;
      this.camFY += dy > m ? m : dy < -m ? -m : dy;
    } else {
      const e = 1 - Math.exp(-dt / EASE_TAU);
      this.camFX += (tx - this.camFX) * e; this.camFY += (ty - this.camFY) * e;
      if (Math.abs(tx - this.camFX) < .01) this.camFX = tx;
      if (Math.abs(ty - this.camFY) < .01) this.camFY = ty;
    }
    const nx = Math.round(this.camFX * this.k) / this.k, ny = Math.round(this.camFY * this.k) / this.k;
    this.camMoved = nx !== this.camX || ny !== this.camY;
    this.camX = nx; this.camY = ny;
  }

  /* ---------- the loop, paused off screen and in a hidden tab ---------- */
  private start() {
    if (this.raf || this.dead || this.o.reduced || !this.visible || document.hidden) return;
    this.last = performance.now();
    if (this.smooth) { this.govern(0, 0, false, true); this.govAt = this.last; }
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (this.smooth) { this.frameLive(now); return; }
      if (now - this.last < 1000 / 32) return;
      this.step(Math.min(.1, (now - this.last) / 1000));
      this.last = now;
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  /**
   * The library's frame: every display frame while something in view moves (or a walking key is down) and the governor
   * allows 60 Hz, else at the old 30 Hz gate. Standing still costs what it did.
   */
  private frameLive(now: number) {
    const gap = now - this.last;
    const fast = this.hz60 && (this.motion || this.keysDown.size > 0);
    if (gap < (fast ? GAP_60 : GAP_30)) return;
    const w0 = performance.now();
    this.step(Math.min(.1, gap / 1000));
    this.last = now;
    this.draw();
    this.govern(performance.now() - w0, gap, fast, false);
  }

  /**
   * The frame governor. 60 Hz doubles the draw work of 30, and nothing in the page can see the GPU, so the page watches
   * itself: the rolling 95th percentile of a frame's own work (step and draw, JS side) and how many frames came a display
   * refresh late. Over `GOV_KEEP_MS`, or a quarter late, it presents at 30 Hz; it tries 60 again only when the work is
   * well under (`GOV_RETURN_MS`) and after a hold that doubles every time it has had to fall back. `data-hz` on the
   * canvas says which (and `hz` on the handle, in development).
   */
  private govern(work: number, gap: number, fast: boolean, reset: boolean) {
    if (reset) { this.govN = 0; this.govI = 0; this.govTick = 0; this.govLate.fill(0); this.lateSum = 0; this.lateI = 0; this.govFrom = performance.now() + 1500; this.setHz(this.hz60); return; }
    const W = this.govWork;
    W[this.govI] = work; this.govI = (this.govI + 1) % W.length; if (this.govN < W.length) this.govN++;
    if (fast && performance.now() > this.govFrom) {            // not the first moments after the page, a tab or the room woke (decoding, layout)
      const late = gap > GOV_LATE_MS && gap < 300 ? 1 : 0, L = this.govLate;
      this.lateSum += late - L[this.lateI]; L[this.lateI] = late; this.lateI = (this.lateI + 1) % L.length;
    }
    if (++this.govTick < 30 || this.govN < 60) return;
    this.govTick = 0;
    const S = this.govSort;
    for (let i = 0; i < this.govN; i++) S[i] = W[i];
    const sorted = S.subarray(0, this.govN).sort();
    const p95 = sorted[Math.floor((this.govN - 1) * .95)], now = performance.now();
    if (this.hz60) {
      if (p95 > GOV_KEEP_MS || this.lateSum >= this.govLate.length / 4) { this.govFalls++; this.govAt = now; this.setHz(false); }
    } else if (p95 < GOV_RETURN_MS && now - this.govAt > 30_000 * 2 ** Math.min(4, this.govFalls - 1)) {
      this.govAt = now; this.govLate.fill(0); this.lateSum = 0; this.setHz(true);
    }
  }

  private setHz(on: boolean) {
    if (on && !this.hz60) this.motion = true;
    this.hz60 = on;
    this.canvas.dataset.hz = on ? "60" : "30";
  }

  /** Which rate the library is presenting at (the governor's verdict); 60 until it has had to fall back. */
  get hz(): 30 | 60 { return this.hz60 ? 60 : 30; }

  private stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  private bind() {
    const on = (el: EventTarget, ev: string, fn: (e: Event) => void) => {
      el.addEventListener(ev, fn);
      this.cleanup.push(() => el.removeEventListener(ev, fn));
    };
    on(this.canvas, "click", ev => {
      this.tap(...at(ev as MouseEvent));
      if (this.playable) this.canvas.focus({ preventScroll: true });
    });
    const at = (e: MouseEvent): [number, number] => {
      const r = this.canvas.getBoundingClientRect();
      return [((e.clientX - r.left) * this.dpr - this.offX) / this.k + this.camX, ((e.clientY - r.top) * this.dpr - this.offY) / this.k + this.camY];
    };
    on(this.canvas, "pointermove", ev => {
      const e = ev as PointerEvent;
      if (e.pointerType !== "mouse") return;
      const p = this.hit(...at(e));
      const h = p && !p.you ? p : null;
      this.canvas.style.cursor = h ? "pointer" : "";
      if (h !== this.hover) { this.hover = h; if (this.o.reduced) this.draw(); }
      if (this.W) this.pointAtSeat(h ? null : this.seatAt_(...at(e)));
    });
    on(this.canvas, "pointerleave", () => { this.hover = null; this.canvas.style.cursor = ""; if (this.W) this.pointAtSeat(null); if (this.o.reduced) this.draw(); });
    if (this.W) this.bindWalk(on);
    if (!this.W) {
      const KEYS: Record<string, Dir> = { ArrowRight: "right", ArrowLeft: "left", ArrowUp: "back", ArrowDown: "front" };
      on(this.canvas, "keydown", ev => {
        const e = ev as KeyboardEvent;
        if (!this.playable) return;
        const d = KEYS[e.key];
        if (d) {
          e.preventDefault();
          this.held = d;
          if (this.o.reduced) { this.nudgeNow(d); return; }
          if (this.you && !this.you.path.length) this.nudge(d);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.sitNearby();
        }
      });
      on(this.canvas, "keyup", ev => { if (KEYS[(ev as KeyboardEvent).key] === this.held) this.held = null; });
      on(this.canvas, "blur", () => { this.held = null; });
    }
    const io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.start(); else this.stop(); });
    io.observe(this.canvas);
    this.cleanup.push(() => io.disconnect());
    on(document, "visibilitychange", () => { if (document.hidden) this.stop(); else this.start(); });
    const ro = new ResizeObserver(() => { this.resize(); this.draw(); });
    ro.observe(this.canvas);
    this.cleanup.push(() => ro.disconnect());
  }

  /** Reduced motion: a step is a jump to the next tile, drawn once. */
  private nudgeNow(d: Dir) {
    const you = this.you;
    if (!you) return;
    this.nudge(d);
    if (you.path.length) { [you.x, you.y] = you.path[you.path.length - 1]; you.path = []; you.doing = "idle"; }
    this.held = null;
    this.draw(); this.status();
  }


  /* ---------- library mode: free movement, seat rings, the key prompt ---------- */

  /** Keys and focus. The room takes W A S D and the arrows (and E, Enter, Space) while it has the page's attention. */
  private bindWalk(on: (el: EventTarget, ev: string, fn: (e: Event) => void) => void) {
    const clear = () => { this.keysDown.clear(); };
    on(window, "keydown", ev => {
      const e = ev as KeyboardEvent, code = e.code, move = KEY_MOVES[code], sit = code === "Enter" || code === "Space" || code === "KeyE";
      if (!this.you || this.dead || !(move || sit)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const el = e.target instanceof Element ? e.target : document.body;
      if (typingIn(el)) { clear(); return; }
      const onCanvas = el === this.canvas, bare = el === document.body || el === document.documentElement;
      if (!onCanvas) {
        if (el.closest(OWN_KEYS)) return;
        if (bare) {
          // nothing has focus: the room has the keys while it is on screen and nothing modal is open
          if (!this.visible || document.hidden || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
          // seated, the arrows stay the page's (to scroll); W A S D and E are the room's
          if (this.seated && code.startsWith("Arrow")) return;
        } else if ((code === "Enter" || code === "Space") && el.closest('button,a,summary,[role="button"],[role="link"],[tabindex]')) return;   // they act on what has focus
      }
      if (move) {
        e.preventDefault();
        if (this.o.reduced) { this.keysDown.add(code); this.nudgeNow(KEY_DIR[move.join()]); this.keysDown.delete(code); return; }
        if (e.repeat && this.keysDown.has(code)) return;
        this.keysDown.add(code);
        this.takeOff();
        return;
      }
      if (code === "KeyE") {
        if (this.seated) { e.preventDefault(); this.stand(); }
        else if (this.nearSeat()) { e.preventDefault(); this.sitNearby(); }
        return;
      }
      // Enter and Space: sit in the chair that is near. On the canvas they always belong to the room; elsewhere only when they do something.
      if (onCanvas || this.nearSeat()) { e.preventDefault(); this.sitNearby(); }
    });
    on(window, "keyup", ev => { this.keysDown.delete((ev as KeyboardEvent).code); });
    on(window, "blur", clear);
    on(document, "visibilitychange", () => { if (document.hidden) clear(); });
    on(document, "focusin", ev => { if (typingIn(ev.target as Element | null)) clear(); if (this.o.reduced) this.draw(); });
    on(document, "focusout", () => { if (this.o.reduced) this.draw(); });
  }

  /** You press a walking key: whatever you were doing (a walk to a tap, the way to a chair, sitting) gives way. */
  private takeOff() {
    const you = this.you;
    if (!you || you.doing === "enter") return;
    const wasSeated = you.at, wasWalking = you.path.length > 0;
    if (wasWalking) { you.path = []; you.doing = "idle"; }
    this.release(you);
    if (wasSeated) {
      you.at = false; you.doing = "idle";
      const [x, y] = this.feet(this.nearestTile(you.x, you.y));
      you.x = x; you.y = y;
    }
    if (wasSeated || wasWalking) this.announce();      // you got up, or the walk you were on is off
  }

  /** The direction the held keys ask for: [-1..1, -1..1] (opposite keys cancel). */
  private keyAxes(): [number, number] {
    const ax = new Set([...this.keysDown].filter(c => KEY_MOVES[c]).map(c => KEY_MOVES[c].join()));
    return [(ax.has("1,0") ? 1 : 0) - (ax.has("-1,0") ? 1 : 0), (ax.has("0,1") ? 1 : 0) - (ax.has("0,-1") ? 1 : 0)];
  }

  /** One frame of walking under the keys: true when it moved you (or pushed on a wall), so the path logic leaves you be. */
  private keyStep(p: Person, dt: number): boolean {
    const W = this.W!, g = this.grid!;
    const [kx, ky] = this.keyAxes();
    if ((kx === 0 && ky === 0) || p.doing === "enter" || p.at || p.path.length || p.spot) {
      if (p.moving) this.stopMoving(p);
      return false;
    }
    const [hx, hy] = W.heading(kx, ky);
    this.heading = [hx, hy];
    if (!W.fits(g, p.x, p.y)) [p.x, p.y] = W.settle(g, p.x, p.y);
    const [nx, ny] = W.slide(g, p.x, p.y, hx * LIVE_SPEED * dt, hy * LIVE_SPEED * dt);
    const dx = nx - p.x, dy = ny - p.y;
    if (Math.hypot(dx, dy) < 1e-6) {
      // pushing on a wall: face it, and stand
      p.dir = W.facing(hx, hy, p.dir);
      if (p.moving) this.stopMoving(p);
      return true;
    }
    p.x = nx; p.y = ny;
    p.dir = W.facing(dx, dy, p.dir);
    p.moving = true; p.doing = "walk";
    this.youTold();
    return true;
  }

  private stopMoving(p: Person) {
    p.moving = false; p.doing = "idle";
    this.heading = [0, 0];
    this.youTold();        // where you ended: at once, or as soon as the wire's 100 ms floor allows
  }

  /** Your place changed: tell the visit, at most every `YOU_GAP`. */
  private youTold() {
    if (this.t - this.lastYou >= YOU_GAP) this.announce(); else this.youOwed = true;
  }
  private announce() {
    this.youOwed = false;
    this.lastYou = this.t;
    this.youChanged();
  }

  /** The free chair one would sit in now (what Enter, Space and E take): the nearest within `NEAR_SEAT`, when one is standing free and not already going to one. */
  private nearSeat(): Spot | null {
    const you = this.you, W = this.W;
    if (!you || !W || you.at || you.spot || you.path.length || you.doing === "enter" || you.alpha < .5) return null;
    let best: Spot | null = null, bd = NEAR_SEAT;
    for (const s of this.ringSeats) {
      if (s.who) continue;
      const [cx, cy] = W.centreOf(s.tile);
      const d = Math.min(Math.hypot(you.x - cx, you.y - cy), Math.hypot(you.x - (s.x + 8), you.y - (s.y + 31)));
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /** The chair a tap at an art pixel would take: the nearest ring among the chairs whose place is under it, that are free or yours. */
  private seatAt_(ax: number, ay: number): Spot | null {
    let best: Spot | null = null, bd = Infinity;
    for (const s of this.spots) {
      if (!(s.role === "seat" || s.role === "sofa") || !this.canSit(s) || (s.who && s.who !== this.you)) continue;
      if (!(ax >= s.x - 3 && ax < s.x + 19 && ay >= s.y + 4 && ay < s.y + 36)) continue;
      const d = Math.hypot(ax - (s.x + RING.x), ay - (s.y + RING.y));
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /** The chair under the mouse, if it shows a ring (free and reachable): it lights up. */
  private pointAtSeat(s: Spot | null) {
    if (s && (s.who || !this.ringSeats.includes(s))) s = null;
    if (s === this.hoverSeat) return;
    this.hoverSeat = s;
    if (this.o.reduced) this.draw();
  }

  private get typingNow() { return typingIn(document.activeElement); }

  /** Draws each free chair's ring into the depth order: above the chair's own art, below anyone standing in front of it. */
  private addRings(tick: number) {
    const art = (this.libArt ??= this.buildArt());
    const lit = this.nearSeat(), frame = this.o.reduced ? 0 : Math.floor(tick / 5) % 2;
    let n = 0;
    for (const s of this.ringSeats) {
      if (s.who) continue;
      n++;
      if (!this.near(s.x - 4, s.y, 24, 32)) continue;
      const on = s === lit || s === this.hoverSeat;
      const img = art.rings[on ? "near" : "idle"][frame], w = img.width, h = img.height;
      const it = this.item(s.sort + .005, 4);
      it.img = img; it.x = Math.round(s.x + RING.x - w / 2 + .5); it.y = Math.round(s.y + RING.y - h / 2 + .5);
    }
    const prompt = this.promptFor(lit);
    const mark = `${n}|${prompt}|${lit ? this.ipadOf.get(lit) ?? "" : ""}`;
    if (mark !== this.shown) {
      this.shown = mark;
      this.canvas.dataset.rings = String(n);
      this.canvas.dataset.prompt = prompt;
      this.canvas.dataset.near = lit ? String(this.ipadOf.get(lit) ?? "") : "";
    }
  }

  /** What the one key prompt says: "sit" beside a chair, "stand" while you sit, nothing otherwise (or while typing). */
  private promptFor(lit: Spot | null): "" | "sit" | "stand" {
    if (!this.keyHints || this.typingNow || !this.you || this.you.alpha < .5) return "";
    if (this.seated) return "stand";
    return lit ? "sit" : "";
  }

  /** The "E" keycap over the chair you could sit in (it bobs), or "E stand" by you while you sit: over everything, in art pixels, so it scales and follows the camera. */
  private drawPrompt(tick: number, sc = this.sc) {
    const art = this.libArt, you = this.you;
    if (!art || !you) return;
    const kind = this.promptFor(this.nearSeat());
    this.promptBox = null;
    if (!kind) return;
    const bob = this.o.reduced ? 0 : [0, 0, -1, -1][Math.floor(tick / 3) % 4];
    let img: HTMLCanvasElement, x: number, y: number;
    if (kind === "stand") {
      const s = you.spot!;
      img = art.stand; x = s.x + 8 - Math.floor(img.width / 2); y = s.y + 33 + bob;
    } else {
      const s = this.nearSeat()!;
      img = art.key; x = s.x + RING.x - Math.floor(img.width / 2); y = s.y + RING.y - 6 - img.height - 2 + bob;
    }
    x = Math.min(Math.max(x, this.camX + 2), this.camX + this.viewW - img.width - 2);
    y = Math.min(Math.max(y, this.camY + 2), this.camY + this.viewH - img.height - 2);
    sc.drawImage(img, Math.round(x), Math.round(y));
    this.promptBox = [Math.round(x), Math.round(y), img.width, img.height];
  }

  /** Whether your own name tag would sit on the key prompt (then the tag steps aside, so the prompt reads). */
  private tagOnPrompt(p: Person, el: HTMLElement): boolean {
    const b = this.promptBox;
    if (!b || p !== this.you) return false;
    const s = this.k / this.dpr, [x, y] = this.spriteAt(p), w = (this.widths.get(el) ?? 40) / s, h = 22 / s;
    const m = x + this.half(p), t = y + this.crown(p);
    return m + w / 2 > b[0] && m - w / 2 < b[0] + b[2] && t > b[1] && t - h < b[1] + b[3];
  }

  /** The ring, the keycap and the "E stand" pill, drawn once in art pixels. */
  private buildArt() {
    const px = (w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) => {
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      paint(cv.getContext("2d")!);
      return cv;
    };
    const GOLD = "242,201,107", BRIGHT = "255,217,90", EDGE = "74,46,16";
    /** A ring of radius r about the middle pixel, with a dark edge outside it and a soft fill within; `shade` lays a translucent disc of the ring's yellow under the chair. */
    const ring = (r: number, bright: boolean, shade: boolean) => px(19, 19, c => {
      const img = c.createImageData(19, 19), d = img.data, col = bright ? BRIGHT : GOLD;
      for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) {
        const dist = Math.hypot(x - 9, y - 9), i = (y * 19 + x) * 4;
        let rgb = "", a = 0;
        if (Math.abs(dist - r) <= .62) { rgb = col; a = bright ? 1 : .92; }
        else if (Math.abs(dist - (r + 1.15)) <= .55) { rgb = EDGE; a = .5; }
        else if (dist < r - .62) { rgb = col; a = bright ? .40 : .24; }
        else if (shade && dist < 9.2) { rgb = BRIGHT; a = dist < 7.2 ? .36 : .24; }
        if (!rgb) continue;
        const [R, G, B] = rgb.split(",").map(Number);
        d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = Math.round(a * 255);
      }
      c.putImageData(img, 0, 0);
    });
    /** The keycap: a cream cap with a dark edge and the letter drawn in 3 x 5 pixels. */
    const cap = (c: CanvasRenderingContext2D, x: number, y: number) => {
      c.fillStyle = "#22304d"; c.fillRect(x, y, 9, 10);
      c.fillStyle = "#c9c0a8"; c.fillRect(x + 1, y + 1, 7, 8);
      c.fillStyle = "#fffdf5"; c.fillRect(x + 1, y + 1, 7, 7);
      c.fillStyle = "#22304d";
      GLYPH.E.forEach((row, j) => [...row].forEach((v, i) => { if (v === "1") c.fillRect(x + 3 + i, y + 2 + j, 1, 1); }));
      c.clearRect(x, y, 1, 1); c.clearRect(x + 8, y, 1, 1); c.clearRect(x, y + 9, 1, 1); c.clearRect(x + 8, y + 9, 1, 1);
    };
    const key = px(9, 10, c => cap(c, 0, 0));
    const word = "STAND", textW = word.length * 4 - 1, W = 9 + 2 + textW + 3;
    const stand = px(W, 10, c => {
      c.fillStyle = "#22304d"; c.fillRect(5, 1, W - 5, 8);
      c.clearRect(W - 1, 1, 1, 1); c.clearRect(W - 1, 8, 1, 1);
      cap(c, 0, 0);
      c.fillStyle = "#fffdf5";
      [...word].forEach((ch, k) => GLYPH[ch].forEach((row, j) => [...row].forEach((v, i) => { if (v === "1") c.fillRect(11 + k * 4 + i, 2 + j, 1, 1); })));
    });
    return { rings: { idle: [ring(4, false, false), ring(4.7, false, false)], near: [ring(4.9, true, true), ring(5.6, true, true)] }, key, stand };
  }

  /* ---------- library mode: real people in the room (LiveHooks) ---------- */

  /** Whether a chair is one you and others may take: in the library, only the iPad's seats (the rest are scenery there). */
  private canSit(s: Spot) { return !this.libSeats || this.libSeats.has(s); }

  /** Builds the library's chairs from the study app's seat table; a chair the layout left empty is added from the iPad's own coordinates. */
  private libraryTable() {
    this.libSeats = new Set();
    for (const d of this.live!.seats(this.a.L.spots)) {
      const spot = d.spot !== null ? this.spots[d.spot] : this.addSpot(d);
      if (!spot) continue;
      this.libSeats.add(spot);
      if (d.ipad !== null) { this.byIpad.set(d.ipad, spot); this.ipadOf.set(spot, d.ipad); }
    }
    // a ring only where one can get to: the chair's own tile is on the floor one can walk from the door
    if (this.W) {
      const here = new Set(this.W.reach(this.grid!, this.L.door.tile));
      this.ringSeats = [...this.libSeats].filter(s => here.has(s.tile[1] * this.L.cols + s.tile[0]));
    }
  }

  /** A chair the layout has no one in: its sort is that of the chair piece it sits in (so it is drawn in front of the chair and behind the table). */
  private addSpot(d: LiveSeat): Spot {
    const chair = this.L.pieces.find(q => q.w >= 8 && q.w <= 16 && q.h >= 17 && q.h <= 26 && Math.abs(q.x - (d.x + (d.face === "left" ? 2 : 1))) <= 1 && Math.abs(q.y - (d.y + 14)) <= 2);
    const spot: Spot = { role: "seat", pose: "sit", face: d.face, x: d.x, y: d.y, sort: chair ? chair.z + .5 : d.y + 36, tile: this.nearestTile(d.x + 8, d.y + 31), who: null };
    this.spots.push(spot);
    return spot;
  }

  private youChanged() { this.looking = null; this.live?.onYou?.(); }

  dressYou(sheet: CanvasImageSource | null, phones = false, frameW?: number) {
    const you = this.you;
    if (!you || !this.live) return;
    you.sheet = sheet; you.sheetPhones = phones; you.fw = sheet ? wide(frameW) : undefined;
    this.draw();
  }

  get seated() { const s = this.you?.spot; return !!this.you?.at && !!s && (s.role === "seat" || s.role === "sofa"); }

  youNow(): LiveYou | null {
    const you = this.you;
    if (!you) return null;
    if (you.at && you.spot) return { x: you.spot.x, y: you.spot.y, seat: this.ipadOf.get(you.spot) ?? null, path: [], walking: false };
    const x = Math.round(you.x) - 8, y = Math.round(you.y) - 31;       // on the wire a sprite is the 16 wide one's top left, on whole art pixels (the picture of it may sit between)
    if (this.W && you.moving) {
      // walking under the keys: the next half second, a couple of points, so others carry on along it (and not through a wall)
      const [hx, hy] = this.heading;
      const path = this.W.ahead(this.grid!, you.x, you.y, hx, hy, LIVE_SPEED, [.25, .5]).map(([fx, fy]) => [fx - 8, fy - 31] as ArtPoint);
      return { x, y, seat: null, path, walking: true };
    }
    return { x, y, seat: null, path: you.path.map(([fx, fy]) => [fx - 8, fy - 31] as ArtPoint), walking: you.path.length > 0 };
  }

  private takeSeat(you: Person, s: Spot): boolean {
    if (this.o.reduced) { this.release(you); this.seatAt(you, s, Infinity); this.seatedAt = this.t; this.draw(); }
    else if (!this.sendTo(you, s)) return false;
    this.youChanged();
    return true;
  }

  sit(): boolean {
    const you = this.you;
    if (!you || you.doing === "enter") return false;
    if (this.seated) return true;
    const [fx, fy] = [you.x, you.y];
    const near = this.free().filter(s => !s.who || s.who === you).sort((a, b) => Math.hypot(a.x + 8 - fx, a.y + 31 - fy) - Math.hypot(b.x + 8 - fx, b.y + 31 - fy));
    for (const s of near.slice(0, 6)) if (this.takeSeat(you, s)) return true;
    return false;
  }

  sitIn(ipad: number): boolean {
    const you = this.you, s = this.byIpad.get(ipad);
    if (!you || !s || you.doing === "enter" || (s.who && s.who !== you)) return false;
    return this.takeSeat(you, s);
  }

  stand() {
    const you = this.you;
    if (!you?.at) return;
    this.release(you);
    you.doing = "idle";
    [you.x, you.y] = this.feet(this.nearestTile(you.x, you.y));
    this.draw();
    this.youChanged();
  }

  goTo(id: string): boolean {
    const p = this.remotes.get(id);
    if (!p || !this.you) return false;
    this.joinPerson(p);
    return !!this.you.spot;
  }

  select(id: string | null) {
    this.picked = id ? this.remotes.get(id) ?? null : null;
    this.draw();
  }

  say(who: string, text: string) {
    const p = who === "you" ? this.you : this.remotes.get(who);
    if (p && p.alpha > .3) this.pop(p, text);
  }

  bubble(who: string, text: string, ms: number): boolean {
    const p = who === "you" ? this.you : this.remotes.get(who);
    if (!p || !this.live || this.dead || p.alpha <= .3) return false;
    this.clearBubble(p);
    // beside someone else's bubble it goes up a line; with two there already, it is left out rather than pile up
    const [x, y] = this.spriteAt(p), s = this.k / this.dpr;
    let lift = 0;
    for (const [q, b] of this.bubbles) {
      const [qx, qy] = this.spriteAt(q);
      if (Math.abs(qx - x) * s < 150 && Math.abs(qy - y) * s < 50 + b.lift * 34) lift = Math.max(lift, b.lift + 1);
    }
    if (lift > 1) return false;
    while (this.bubbles.size >= 4) this.clearBubble(this.bubbles.keys().next().value as Person);
    const el = document.createElement("div");
    el.className = this.cn.bub;
    el.textContent = text;
    el.style.setProperty("--bub-ms", `${ms}ms`);
    this.overlay.appendChild(el);
    this.widths.set(el, el.offsetWidth);
    this.bubbles.set(p, { el, lift, timer: setTimeout(() => this.clearBubble(p), ms + 100) });
    this.place();
    return true;
  }

  private clearBubble(p: Person) {
    const b = this.bubbles.get(p);
    if (!b) return;
    clearTimeout(b.timer);
    b.el.remove();
    this.bubbles.delete(p);
  }

  lookAt(id: string | null): boolean {
    const p = id ? this.remotes.get(id) ?? null : null;
    this.looking = p;
    if (this.o.reduced) this.draw();
    return id === null || !!p;
  }

  /** Tells the room who else is in it. Each person is placed where they said (or in a free chair, if they said nothing of the floor). */
  setRemotes(list: readonly LiveRemote[]) {
    if (!this.live || this.dead) return;
    const seen = new Set<string>();
    for (const r of list) {
      seen.add(r.id);
      let p = this.remotes.get(r.id);
      if (!p) {
        // back within the fade-out of having left: the same sprite, not a second one beside it
        const leaving = this.people.find(q => q.id === r.id && q.doing === "leave");
        if (leaving) { p = leaving; p.doing = "idle"; p.rev = -1; this.remotes.set(r.id, p); }
      }
      if (!p) {
        const d = this.L.door;
        p = this.person(r.look, d.x, d.y, "front");
        p.id = r.id; p.remote = true; p.speed = LIVE_SPEED; p.who = ""; p.alpha = this.o.reduced ? 1 : 0;
        this.remotes.set(r.id, p);
        this.people.push(p);
      }
      p.look = r.look;
      p.sheet = r.sheet ?? null; p.sheetPhones = r.phones ?? false; p.fw = r.sheet ? wide(r.frameW) : undefined;
      this.place_(p, r);
    }
    for (const [id, p] of [...this.remotes]) {
      if (seen.has(id)) continue;
      this.remotes.delete(id);
      if (this.o.reduced) { this.remove(p); continue; }
      this.release(p);
      p.path = []; p.doing = "leave";
    }
    this.libraryLabels();
    if (this.o.reduced) this.draw();
  }

  /** One person's place: their seat if they sit (and it is theirs), else where they stand and the walk they are on. */
  private place_(p: Person, r: LiveRemote) {
    if (p.known && r.rev === p.rev && r.seated === p.said) return;     // nothing new about where they are: they carry on as they were
    p.rev = r.rev; p.said = r.seated;
    const seat = r.seat !== null ? this.byIpad.get(r.seat) : undefined;
    if (seat && (!seat.who || seat.who === p) && seat !== this.you?.spot) {
      if (p.spot !== seat || !p.at) { this.release(p); this.seatAt(p, seat, Infinity); }
      p.path = []; p.known = true;
      return;
    }
    // No fresh news of the floor (Realtime is down, or they have not spoken for a while): the server's word on whether they sit is all there is.
    if (!r.pos && r.seated) {
      if (p.at && p.spot && this.canSit(p.spot)) { p.path = []; p.known = true; return; }          // they sat where they were: they stay there
      const chair = this.chairFor(p);
      if (chair) { this.release(p); this.seatAt(p, chair, Infinity); p.path = []; p.known = true; return; }
    }
    const wasSeated = p.at;
    if (wasSeated) { this.release(p); p.doing = "idle"; if (!r.pos) [p.x, p.y] = this.feet(this.nearestTile(p.x, p.y)); }
    if (r.pos) {
      const feet: ArtPoint = [r.pos[0] + 8, r.pos[1] + 31];
      // near where they are drawn they carry on from there; far, or just up from a seat, they are put where they said
      // (LibraryScene.remoteHeard: a walk is short, so a jump is the exception; 48 points there, 24 pixels here)
      if (!p.known || wasSeated || this.o.reduced || Math.hypot(p.x - feet[0], p.y - feet[1]) > 24) { [p.x, p.y] = feet; p.known = true; }
      const path = r.path.map(([x, y]) => [x + 8, y + 31] as [number, number]);
      if (this.o.reduced && path.length) { [p.x, p.y] = path[path.length - 1]; p.path = []; }
      else p.path = path;
      p.doing = p.path.length ? "walk" : "idle";
      return;
    }
    // Standing, and nothing said of where: out of the chairs (they are not sitting), near the door, the same place for everyone who looks
    if (!p.known) { this.standNear(p); p.known = true; }
  }

  /** A person's id as a number, the same on every screen. */
  private hashOf(id: string | undefined) {
    let h = 5381;
    for (const c of id ?? "") h = (Math.imul(h, 33) + c.charCodeAt(0)) >>> 0;
    return h;
  }

  /** The chair a seated person is drawn in when nobody has said which: their own place in the table, then the next free one on. */
  private chairFor(p: Person): Spot | null {
    const all = [...(this.libSeats ?? [])];
    const h = this.hashOf(p.id);
    for (let i = 0; i < all.length; i++) {
      const s = all[(h + i) % all.length];
      if (!s.who || s.who === p) return s;
    }
    return null;
  }

  /** Somewhere to stand among the tiles nearest the door, picked by their id: a standing student whose place is not known is not put in a chair. */
  private standNear(p: Person) {
    if (!this.W || !this.grid) return;
    const tiles = this.W.reach(this.grid, this.L.door.tile);
    if (!tiles.length) return;
    const from = Math.min(3, tiles.length - 1), span = Math.max(1, Math.min(tiles.length - from, 80));
    const k = tiles[from + (this.hashOf(p.id) % span)];
    [p.x, p.y] = this.feet([k % this.L.cols, Math.floor(k / this.L.cols)]);
    p.path = []; p.doing = "idle"; p.dir = "front";
  }

  /** The names over the heads of whoever is on screen: friends and the one you tapped first, then the nearest; never so many they pile up. */
  private libraryLabels() {
    const live = this.live;
    if (!live) return;
    const you = this.you;
    if (you) this.label(you, "You", this.cn.you);
    const [yx, yy] = you ? this.spriteAt(you) : [this.camX, this.camY];
    const rank = (p: Person) => (p === this.picked ? -1e6 : 0) + (live.describe?.(p.id!)?.friend ? -1e3 : 0) + Math.hypot(this.spriteAt(p)[0] - yx, this.spriteAt(p)[1] - yy);
    const near = [...this.remotes.values()].filter(p => p.alpha > .3 && this.onScreen(p)).sort((a, b) => rank(a) - rank(b));
    const shown: Person[] = you ? [you] : [];
    const keep = new Set<Person>();
    const max = this.overlay.clientWidth < 480 ? 6 : 14;
    for (const p of near) {
      if (keep.size >= max) break;
      const d = live.describe?.(p.id!);
      if (!d) continue;
      if (p !== this.picked && this.crowded(p, shown)) continue;
      shown.push(p); keep.add(p);
      this.label(p, d.tag ? `${d.name}\n${d.tag}` : d.name, this.cn.nm + (d.friend ? " is-friend" : "") + (d.pro ? " is-pro" : ""));
    }
    for (const [p, el] of [...this.labels]) if (p !== you && !keep.has(p)) { el.remove(); this.labels.delete(p); }
  }

  destroy() {
    this.dead = true;
    this.stop();
    for (const f of this.cleanup) f();
    for (const el of this.labels.values()) el.remove();
    for (const q of this.pops) q.el.remove();
    for (const p of [...this.bubbles.keys()]) this.clearBubble(p);
    this.card?.remove();
  }
}
