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
let loading: Promise<Assets> | null = null;

function image(name: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`cafe: ${name}`));
    im.src = BASE + name;
  });
}

function loadAssets(): Promise<Assets> {
  loading ??= Promise.all([
    fetch(BASE + "layout.json").then(r => { if (!r.ok) throw new Error("layout.json"); return r.json() as Promise<Layout>; }),
    image("bg.png"), image("pieces.png"), image("anims.png"), image("people.png"),
  ]).then(([L, bg, pieces, anims, people]) => ({ L, bg, pieces, anims, people }));
  loading.catch(() => { loading = null; });
  return loading;
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
export interface CafeOptions {
  mode: "hero" | "friends";
  reduced: boolean;
  look?: number;
  onStatus?: (s: CafeStatus) => void;
}
export interface CafeHandle {
  destroy(): void;
  setLook(look: number): void;
  readonly looks: number;
  readonly look: number;
}

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
  private labels = new Map<Person, HTMLElement>();
  private widths = new WeakMap<HTMLElement, number>();
  private pops: { el: HTMLElement; x: number; y: number; born: number }[] = [];
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
  looks: number;
  look = 0;

  constructor(private canvas: HTMLCanvasElement, private overlay: HTMLElement, private a: Assets, private o: CafeOptions) {
    this.L = a.L;
    this.spots = a.L.spots.map(s => ({ ...s, who: null }));
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
      alpha: 1, who: pick(NAMES.filter(n => !taken.has(n))) ?? pick(NAMES), subject: pick(SUBJECTS), mins: Math.floor(rand(4, 48)),
      since: this.t - rand(0, 59), speed: rand(22, 28) };
  }

  private seatAt(p: Person, s: Spot, until: number) {
    s.who = p; p.spot = s; p.at = true; p.doing = s.role === "seat" || s.role === "sofa" ? "sit" : "stand";
    p.x = s.x + 8; p.y = s.y + 31; p.dir = s.face; p.until = until; p.path = [];
  }

  private free(role?: Spot["role"], inRegion = false) {
    return this.spots.filter(s => !s.who && (role ? s.role === role : s.role === "seat" || s.role === "sofa")
      && (!inRegion || this.inRegion(s.x + 8, s.y + 20)));
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
        this.label(you, "You", "lp-nm is-you");
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
    // the visitor comes in at the entrance and walks up the runner into the reading hall's middle aisle
    const d = L.door, you = this.person(this.look, d.x, d.y, "back");
    you.you = true; you.speed = 36; you.who = "You";
    this.you = you;
    this.people.push(you);
    const inside = this.nearest(d.tile, d.x - 8, d.y - 150) ?? d.tile;
    if (this.o.reduced) {
      [you.x, you.y] = this.feet(inside);
    } else {
      you.doing = "enter"; you.alpha = 0;
      you.path = [this.feet(d.tile), ...(this.route(d.tile, inside) ?? []).map(t => this.feet(t))];
    }
    this.label(you, "You", "lp-nm is-you");
  }

  /** How many students the room holds: most of its seats, a few left for the visitor. */
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
  private go(p: Person, tile: [number, number], end?: [number, number]): boolean {
    if (p.at && p.spot) { p.x = this.feet(p.spot.tile)[0]; p.y = this.feet(p.spot.tile)[1]; p.at = false; }
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
    for (const p of [...this.people]) {
      if (p.path.length) this.walk(p, dt);
      else if (p.doing === "walk" || p.doing === "enter") this.arrive(p);
      else if (p.doing === "leave") {
        p.alpha -= dt * 2.5;
        if (p.alpha <= 0) this.remove(p);
      } else if (!p.you && !p.name && p.at && t >= p.until) this.decide(p);
    }
    if (this.o.mode === "hero") {
      const students = this.people.filter(p => !p.you && !p.staff).length;
      if (students < this.crowd + 2 && t >= this.nextArrival) this.arrival();
      if (this.you?.at && (this.you.spot?.role === "seat" || this.you.spot?.role === "sofa")) {
        const minutes = Math.floor((t - this.seatedAt) / 60);
        if (minutes > this.inkPaid) { this.inkPaid = minutes; this.pop(this.you, "+1 ink"); }
      }
    }
    if (t >= this.nextTimers) this.chooseTimers();
    if (t >= this.nextPop) {
      this.nextPop = t + rand(4, 8);
      const seated = this.people.filter(p => p.doing === "sit" && !p.you && !p.name && !this.labels.has(p) && this.onScreen(p) && !this.crowded(p, [...this.labels.keys()]));
      if (seated.length) this.pop(pick(seated), pick(POPS));
    }
    if (this.held && this.you && !this.you.path.length) this.nudge(this.held);
    this.status();
  }

  private walk(p: Person, dt: number) {
    let left = p.speed * dt;
    while (left > 0 && p.path.length) {
      const [tx, ty] = p.path[0], dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > .01 || Math.abs(dy) > .01) p.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "front" : "back");
      if (d <= left) { p.x = tx; p.y = ty; p.path.shift(); left -= d; }
      else { p.x += dx / d * left; p.y += dy / d * left; left = 0; }
    }
    if (p.doing === "enter") p.alpha = Math.min(1, p.alpha + dt * 2.5);
  }

  private arrive(p: Person) {
    if (p.doing === "enter" && !p.spot) {
      p.doing = "idle";
      if (p.you) { this.nextTimers = Math.min(this.nextTimers, this.t + .5); return; }   // in view now: pick who to label
    }
    const s = p.spot;
    if (!s) { p.doing = "idle"; return; }
    const sit = s.role === "seat" || s.role === "sofa";
    p.at = true; p.doing = sit ? "sit" : "stand"; p.dir = s.face;
    p.x = s.x + 8; p.y = s.y + 31;
    if (p.you) { this.seatedAt = this.t; this.inkPaid = 0; this.nextTimers = Math.min(this.nextTimers, this.t + .5); return; }
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
  }

  private sitNearby() {
    const you = this.you;
    if (!you || you.at) return;
    const [tx, ty] = this.tileOf(you.x, you.y);
    const s = this.free().find(x => x.tile[0] === tx && x.tile[1] === ty);
    if (s) this.sendTo(you, s);
  }

  /** The person drawn at an art pixel, the frontmost first. */
  private hit(ax: number, ay: number): Person | null {
    return [...this.people].sort((a, b) => this.z(b) - this.z(a)).find(p => {
      const [x, y] = this.spriteAt(p), tall = p.at && p.spot?.pose === "stool" ? 20 : 32;
      return ax >= x + 2 && ax < x + 14 && ay >= y + 4 && ay < y + tall && p.alpha > .5;
    }) ?? null;
  }

  private tap(ax: number, ay: number) {
    const hit = this.hit(ax, ay);
    if (hit && !hit.you) {
      this.picked = this.picked === hit ? null : hit;
      if (this.o.mode === "friends") this.pop(hit, "High five!");
      this.draw();
      return;
    }
    this.picked = null;
    const you = this.you;
    if (!you || this.o.mode !== "hero") { this.draw(); return; }
    this.yourSubject = null;
    // a free seat?
    const seat = this.spots.find(s => (s.role === "seat" || s.role === "sofa") && ax >= s.x - 3 && ax < s.x + 19 && ay >= s.y + 4 && ay < s.y + 36);
    if (seat && (!seat.who || seat.who === you)) {
      if (seat.who === you && you.at) return;
      if (this.o.reduced) { this.release(you); this.seatAt(you, seat, Infinity); this.seatedAt = this.t; this.draw(); this.status(); return; }
      this.sendTo(you, seat);
      return;
    }
    const from = this.walkable(...this.tileOf(you.x, you.y)) ? this.tileOf(you.x, you.y) : this.nearestTile(you.x, you.y);
    const to = this.nearest(from, ax, ay);
    if (!to) return;
    if (this.o.reduced) {
      this.release(you); you.doing = "idle";
      [you.x, you.y] = this.feet(to);
      this.draw(); this.status();
      return;
    }
    this.release(you);
    this.go(you, to);
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
    if (this.o.reduced) { this.release(you); this.seatAt(you, seat, Infinity); this.seatedAt = this.t; this.draw(); this.status(); return; }
    if (!this.sendTo(you, seat)) this.yourSubject = null;
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
  private label(p: Person, text: string, cls = "lp-nm") {
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
      this.label(p, this.timerText(p), "lp-nm is-timer");
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
    this.label(p, this.timerText(p), "lp-nm is-timer");
  }

  private pop(p: Person, text: string) {
    const el = document.createElement("div");
    el.className = "lp-pop" + (text.startsWith("✓") ? " is-tick" : text.startsWith("+") ? " is-ink" : "");
    el.textContent = text;
    this.overlay.appendChild(el);
    this.widths.set(el, el.offsetWidth);
    const [x, y] = this.spriteAt(p);
    const labelled = this.labels.has(p);
    this.pops.push({ el, x: x + 8, y: y + (labelled ? -8 : 4), born: this.t });
    setTimeout(() => { el.remove(); this.pops = this.pops.filter(q => q.el !== el); }, 1700);
    this.place();
  }

  private onScreen(p: Person) {
    const [x, y] = this.spriteAt(p);
    return x + 8 >= this.camX + 24 && x + 8 < this.camX + this.viewW - 24 && y >= this.camY + 8 && y + 20 < this.camY + this.viewH;
  }

  /** Where each label sits: over its person's head, in CSS pixels over the canvas. */
  private place() {
    const s = this.k / this.dpr;
    const ow = this.overlay.clientWidth;
    const at = (x: number, y: number, el: HTMLElement) => {
      let px = (x - this.camX) * s + this.offX / this.dpr, py = (y - this.camY) * s + this.offY / this.dpr;
      const half = (this.widths.get(el) ?? 0) / 2;
      if (half) px = Math.min(Math.max(px, half + 4), ow - half - 4);   // a label never runs off the window
      py = Math.max(py, 24);
      return `translate(${Math.round(px)}px, ${Math.round(py)}px) translate(-50%, -100%)`;
    };
    this.showCard();
    for (const [p, el] of this.labels) {
      const [x, y] = this.spriteAt(p);
      el.style.transform = at(x + 8, y + 5, el);
      el.style.opacity = String(this.card && this.cardFor === p ? 0 : p.alpha);
    }
    for (const q of this.pops) q.el.style.transform = at(q.x, q.y, q.el);
    if (this.card && this.cardFor) {
      // over their head, or under their feet when there isn't room above
      const [x, y] = this.spriteAt(this.cardFor), el = this.card, half = el.offsetWidth / 2;
      const px = Math.min(Math.max((x + 8 - this.camX) * s + this.offX / this.dpr, half + 4), ow - half - 4);
      const above = (y + 3 - this.camY) * s + this.offY / this.dpr;
      const below = (y + 32 - this.camY) * s + this.offY / this.dpr + 10;
      el.style.transform = above - el.offsetHeight >= 4
        ? `translate(${Math.round(px)}px, ${Math.round(above)}px) translate(-50%, -100%)`
        : `translate(${Math.round(px)}px, ${Math.round(below)}px) translate(-50%, 0)`;
    }
  }

  /* ---------- drawing ---------- */
  private spriteAt(p: Person): [number, number] {
    if (p.at && p.spot) return [p.spot.x, p.spot.y];
    return [Math.round(p.x) - 8, Math.round(p.y) - 31];
  }

  private z(p: Person) { return p.at && p.spot ? p.spot.sort : p.y; }

  private frame(p: Person, tick: number): number {
    const R = this.L.people.rows, d = DIRS.indexOf(p.dir);
    if (p.path.length) return R.walk + d * 6 + (Math.floor(tick / 2) + p.phase) % 6;
    if (p.at && p.spot) {
      const s = p.spot;
      if (s.pose === "sit") return R.sit + (s.face === "right" ? 0 : 6) + (Math.floor(tick / 8) + p.phase) % 6;
      if (s.pose === "read") return R.read + (Math.floor(tick / 5) + p.phase) % 6;
      if (s.pose === "phone") return R.phone + (Math.floor(tick / 4) + p.phase) % 6;
      return R.idle + DIRS.indexOf(s.face) * 6 + (Math.floor(tick / 6) + p.phase) % 6;
    }
    return R.idle + d * 6 + (Math.floor(tick / 6) + p.phase) % 6;
  }

  private draw() {
    const { L, sc, a } = this;
    const tick = Math.floor(this.t * L.fps);
    sc.globalAlpha = 1;
    sc.drawImage(a.bg, 0, 0);
    type Item = { z: number; draw: () => void };
    const items: Item[] = [];
    // only what is near the window: the library is several windows wide
    const m = 64, vx0 = this.camX - m, vy0 = this.camY - m, vx1 = this.camX + this.viewW + m, vy1 = this.camY + this.viewH + m;
    const near = (x: number, y: number, w: number, h: number) => x < vx1 && x + w > vx0 && y < vy1 && y + h > vy0;
    for (const an of L.anims) {
      if (!near(an.x, an.y, an.w, an.h)) continue;
      const [fx, fy] = an.frames[an.seq[tick % an.seq.length]];
      const draw = () => sc.drawImage(a.anims, fx, fy, an.w, an.h, an.x, an.y, an.w, an.h);
      if (an.z === 0) draw(); else items.push({ z: an.z, draw });
    }
    for (const pc of L.pieces) if (near(pc.x, pc.y, pc.w, pc.h)) items.push({ z: pc.z, draw: () => sc.drawImage(a.pieces, pc.ax, pc.ay, pc.w, pc.h, pc.x, pc.y, pc.w, pc.h) });
    const lit = this.picked ?? this.hover;
    for (const p of this.people) {
      if (p.alpha <= 0) continue;
      const [x, y] = this.spriteAt(p), f = this.frame(p, tick);
      if (!near(x, y, 16, 32)) continue;
      items.push({ z: this.z(p) + .01, draw: () => {
        if (p === lit && !p.you) this.outline(f, p.look, x, y);
        sc.globalAlpha = p.alpha;
        sc.drawImage(a.people, f * 16, p.look * 32, 16, 32, x, y, 16, 32);
        sc.globalAlpha = 1;
      } });
    }
    items.sort((p, q) => p.z - q.z);
    for (const it of items) it.draw();
    sc.drawImage(this.lamp, 0, 0);
    if (this.fire) { sc.globalAlpha = (.30 + .04 * (Math.floor(tick / 3) % 3)) / .38; sc.drawImage(this.fire, 0, 0); sc.globalAlpha = 1; }
    if (!this.o.reduced) this.notes(tick);
    // to the screen, by whole pixels
    const { ctx, canvas } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#2a1d1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.follow(this.o.reduced);
    ctx.drawImage(this.scene, this.camX, this.camY, this.viewW, this.viewH, this.offX, this.offY, this.viewW * this.k, this.viewH * this.k);
    this.place();
  }

  /** A one-pixel white outline round a person: their frame as a white silhouette, drawn a pixel each way. */
  private outline(f: number, look: number, x: number, y: number) {
    const g = this.ghost, gc = g.getContext("2d")!;
    if (g.width !== 16) { g.width = 16; g.height = 32; }
    gc.globalCompositeOperation = "source-over";
    gc.clearRect(0, 0, 16, 32);
    gc.drawImage(this.a.people, f * 16, look * 32, 16, 32, 0, 0, 16, 32);
    gc.globalCompositeOperation = "source-in";
    gc.fillStyle = "#fff";
    gc.fillRect(0, 0, 16, 32);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.sc.drawImage(g, x + dx, y + dy);
  }

  /** The kit's music notes, rising from the headphones of a few who are sitting. */
  private notes(tick: number) {
    const phones = this.L.people.phones, sc = this.sc;
    let i = 0;
    for (const p of this.people) {
      if (p.doing !== "sit" || !phones[p.look] || p.you) continue;
      const ph = (tick + i * 23 + p.phase * 7) % 90;
      i++;
      if (ph >= 30) continue;
      const k = 1 - Math.max(0, ph - 20) / 10, [x, y] = this.spriteAt(p);
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
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.dpr = dpr;
    const W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    const r = this.region;
    // the hero is a window onto part of the library, at the size the café was drawn at, that follows you about
    const want = this.o.mode === "hero" ? (box.width < 560 ? 240 : 400) : r.w;
    const exact = W / want;
    let k = Math.max(1, Math.round(exact));
    if (W / k > r.w * 1.04 || H / k > (this.o.mode === "hero" ? this.L.h : r.h) * 1.04) k = Math.ceil(exact);
    if ((k - exact) / exact > .3 && dpr < 2) k = exact;                // a large crop on a low-density screen: fit instead
    this.k = k;
    this.viewW = Math.min(this.L.w, W / k);
    this.viewH = Math.min(this.L.h, H / k);
    this.offX = Math.max(0, Math.round((W - this.viewW * k) / 2));
    this.offY = Math.max(0, Math.round((H - this.viewH * k) / 2));
    this.follow(true);
  }

  private follow(snap = false) {
    let cx: number, cy: number;
    if (this.o.mode === "hero" && this.you && this.viewW < this.L.w - 1) {
      // a little ahead of you, up into the room: the entrance is at the bottom and the library opens out above it
      const [x, y] = this.spriteAt(this.you);
      cx = x + 8; cy = y + 18 - this.viewH * .2;
    } else {
      cx = this.region.x + this.region.w / 2; cy = this.region.y + this.region.h / 2;
    }
    const tx = Math.min(Math.max(cx - this.viewW / 2, 0), this.L.w - this.viewW);
    const ty = Math.min(Math.max(cy - this.viewH / 2, 0), this.L.h - this.viewH);
    if (snap) { this.camX = tx; this.camY = ty; }
    else { this.camX += (tx - this.camX) * .12; this.camY += (ty - this.camY) * .12; }
    // land the camera on whole art pixels, so every pixel stays the same size
    this.camX = Math.round(this.camX * this.k) / this.k;
    this.camY = Math.round(this.camY * this.k) / this.k;
  }

  /* ---------- the loop, paused off screen and in a hidden tab ---------- */
  private start() {
    if (this.raf || this.dead || this.o.reduced || !this.visible || document.hidden) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (now - this.last < 1000 / 32) return;
      this.step(Math.min(.1, (now - this.last) / 1000));
      this.last = now;
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  private bind() {
    const on = (el: EventTarget, ev: string, fn: (e: Event) => void) => {
      el.addEventListener(ev, fn);
      this.cleanup.push(() => el.removeEventListener(ev, fn));
    };
    on(this.canvas, "click", ev => {
      this.tap(...at(ev as MouseEvent));
      if (this.o.mode === "hero") this.canvas.focus({ preventScroll: true });
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
    });
    on(this.canvas, "pointerleave", () => { this.hover = null; this.canvas.style.cursor = ""; if (this.o.reduced) this.draw(); });
    const KEYS: Record<string, Dir> = { ArrowRight: "right", ArrowLeft: "left", ArrowUp: "back", ArrowDown: "front" };
    on(this.canvas, "keydown", ev => {
      const e = ev as KeyboardEvent;
      if (this.o.mode !== "hero") return;
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

  destroy() {
    this.dead = true;
    this.stop();
    for (const f of this.cleanup) f();
    for (const el of this.labels.values()) el.remove();
    for (const q of this.pops) q.el.remove();
    this.card?.remove();
  }
}
