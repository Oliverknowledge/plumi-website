import { artUrl } from "../art";
import { FOX_H, FOX_ROW_W, FOX_URL, FOX_W, composeFox, type Box } from "./fox";
import { LayerPack } from "./layers";
import { decodePng, type Bitmap } from "./png";
import { lookKey, personOf, stableHash, known, type AvatarKeys, type PeopleCatalogue, type PersonLook } from "./look";
import { FRAME_H, ROW_W, composeRowSteps, layerKeys } from "./sheet";

/**
 * The browser side of the people: fetches the app's layers once (only where this is used, never the homepage), and
 * hands out each person's 78-frame row as a canvas, built when first asked for and cached per distinct look. Asking
 * is synchronous and cheap: a row that is not ready yet answers null (the room keeps the premade person) and tells
 * subscribers when it is. Nothing here throws at a view; if the art cannot be had, every answer is null.
 *
 * Rows are built one at a time, nearest first, each in small steps with the browser given a turn between them: a row
 * is ~20 ms of work, and 50 people arriving together used to be a half-second freeze. The people not built yet wear
 * the premade look meanwhile (the room already does that).
 */

/**
 * One person's (or animal's) 78 frames, ready for the engine. THE FRAME SIZE is per row: a person's frames are 16 x 32
 * (`frame`), the fox's 24 x 32, and `sheet` is 78 frames of that width side by side. `head` is where the head is in the
 * front idle frame (frame `POSE.idle + 18`, that is index 18 of the row), for a list or a card that shows only the head:
 * crop `head` out of `sheet` at x = (18 * frame.w) + head.x. For a person the box is the face and hair (the layers'
 * heads are all in the same place); for the fox it is found from the art (ears down to the sweater).
 */
export interface DrawnPerson { sheet: HTMLCanvasElement; phones: boolean; look: PersonLook; frame: { w: number; h: number }; head: Box }

/** Where a person's head is in a 16 x 32 front frame (every layer has the head at the same place). */
export const PERSON_FRAME = { w: 16, h: 32 } as const;
export const PERSON_HEAD: Box = { x: 2, y: 7, w: 12, h: 13 };
/** The front-facing idle frame's index in every row. */
export const FRONT_IDLE = 18;

const KEEP_ROWS = 80;
const RETRY_AFTER_MS = 30_000;
/** How long a build may run before it lets the page have a turn (a long task is 50 ms; a slow phone is several times a laptop). */
const SLICE_MS = 6;
/** Priorities: lower is built sooner. Yourself, then whoever the page is waiting for, then the room by distance from you. */
export const PRIORITY = { you: -2, asked: -1, room: 0 } as const;

/** Gives the browser a turn: `scheduler.yield()` where there is one (it keeps its place in the queue), else a message. */
function yieldToBrowser(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  if (typeof MessageChannel === "undefined") return new Promise((r) => setTimeout(r, 0));
  return new Promise((resolve) => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); resolve(); }; c.port2.postMessage(0); });
}

/** Asking again: a wanted job (you, or a caller waiting) stays ahead of the room; the room's own are as near as they were last asked. */
function reprioritise(job: { priority: number }, priority: number) {
  job.priority = priority < 0 ? Math.min(job.priority, priority) : job.priority < 0 ? job.priority : priority;
}

interface Job { key: string; look: PersonLook; graded: boolean; priority: number; waiters: ((d: DrawnPerson | null) => void)[] }

export interface PeopleFetch { (url: string): Promise<{ ok: boolean; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }> }

export class PeopleStore {
  private pack: LayerPack | null = null;
  private loading: Promise<boolean> | null = null;
  private failedAt = -Infinity;
  private rows = new Map<string, DrawnPerson>();
  private jobs = new Map<string, Job>();
  private working = false;
  private listeners = new Set<() => void>();

  constructor(
    private get: PeopleFetch = (u) => fetch(u),
    private now: () => number = Date.now,
    private yieldNow: () => Promise<void> = yieldToBrowser,
    private clock: () => number = () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  ) {}

  get catalogue(): PeopleCatalogue | null { return this.pack?.catalogue ?? null; }

  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };
  private changed() { this.listeners.forEach((l) => l()); }

  /** Starts fetching the catalogue and layers if not started (or after a failure, once in a while). Resolves true when they are there. */
  ready(): Promise<boolean> {
    if (this.pack) return Promise.resolve(true);
    if (this.loading) return this.loading;
    if (this.now() - this.failedAt < RETRY_AFTER_MS) return Promise.resolve(false);
    this.loading = (async () => {
      try {
        const [cj, bj] = await Promise.all([this.get(artUrl("people-layers.json")), this.get(artUrl("people-layers.bin"))]);
        if (!cj.ok || !bj.ok) throw new Error("people: fetch");
        const cat = (await cj.json()) as PeopleCatalogue;
        const bin = new Uint8Array(await bj.arrayBuffer());
        if (!cat?.parts || !cat.index) throw new Error("people: catalogue");
        this.pack = new LayerPack(cat, bin);
        this.changed();
        return true;
      } catch {
        this.failedAt = this.now();
        return false;
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  /** The person an avatar (either kind) and an id make, or null until the catalogue is here (it starts loading). */
  lookOf(avatar: AvatarKeys | null | undefined, colour: number, id: string): PersonLook | null {
    const cat = this.catalogue;
    if (!cat) { void this.ready(); return null; }
    return personOf(cat, avatar, colour, id);
  }

  /** A look made to a part this catalogue has (for a look put together by the wardrobe). */
  tidy(look: PersonLook): PersonLook | null {
    const cat = this.catalogue;
    return cat ? known(cat, look) : null;
  }

  /** How many rows are built (for tests). */
  cached(): number { return this.rows.size; }

  /** A drawn person if it is ready; changes nothing and starts nothing (for a render). */
  peek(look: PersonLook | null, graded = true): DrawnPerson | null {
    return look ? this.rows.get(lookKey(look) + (graded ? "" : "#plain")) ?? null : null;
  }

  /**
   * The drawn person for a look: ready now, or null (and on its way: subscribers are told). `priority` says how soon:
   * lower is sooner (the room passes each person's distance from you); asking again moves it.
   */
  row(look: PersonLook | null, graded = true, priority: number = PRIORITY.room): DrawnPerson | null {
    if (!look) return null;
    const key = lookKey(look) + (graded ? "" : "#plain");
    const hit = this.rows.get(key);
    if (hit) { this.rows.delete(key); this.rows.set(key, hit); return hit; }
    if (look.species) { if (!this.building.has(key)) void this.buildAnimal(key, look, graded); return null; }
    if (!this.pack) { void this.ready(); return null; }
    const queued = this.jobs.get(key);
    if (queued) reprioritise(queued, priority);
    else this.enqueue(key, look, graded, priority);
    return null;
  }

  /** Builds a look's row and waits for it (the room waits a moment for you before it opens, so you are not seen changing). */
  async make(look: PersonLook, graded = true, priority: number = PRIORITY.asked): Promise<DrawnPerson | null> {
    if (!(await this.ready())) return null;
    const key = lookKey(look) + (graded ? "" : "#plain");
    const hit = this.rows.get(key);
    if (hit) return hit;
    if (look.species) return this.buildAnimal(key, look, graded);
    const queued = this.jobs.get(key) ?? this.enqueue(key, look, graded, priority);
    reprioritise(queued, priority);
    return new Promise((resolve) => queued.waiters.push(resolve));
  }

  private strip: Promise<Bitmap | null> | null = null;
  private stripFailedAt = -Infinity;
  private building = new Set<string>();
  /** The fox's strip, fetched once (and again after a failure, once in a while). */
  private foxStrip(): Promise<Bitmap | null> {
    if (this.strip) return this.strip;
    if (this.now() - this.stripFailedAt < RETRY_AFTER_MS) return Promise.resolve(null);
    const p = (async () => {
      try {
        const r = await this.get(FOX_URL);
        if (!r.ok) throw new Error("fox: fetch");
        return await decodePng(new Uint8Array(await r.arrayBuffer()));
      } catch {
        this.stripFailedAt = this.now();
        this.strip = null;
        return null;
      }
    })();
    this.strip = p;
    return p;
  }

  /** An animal's row (the fox): from its own strip, not the people's layers, so it does not wait for them. */
  private async buildAnimal(key: string, look: PersonLook, graded: boolean): Promise<DrawnPerson | null> {
    if (typeof document === "undefined") return null;
    this.building.add(key);
    try {
      const strip = await this.foxStrip();
      const fox = strip ? composeFox(strip, { graded }) : null;
      if (!fox) return null;
      const canvas = document.createElement("canvas");
      canvas.width = FOX_ROW_W; canvas.height = FOX_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.putImageData(new ImageData(fox.rgba as Uint8ClampedArray<ArrayBuffer>, FOX_ROW_W, FOX_H), 0, 0);
      const person: DrawnPerson = { sheet: canvas, phones: false, look, frame: { w: FOX_W, h: FOX_H }, head: fox.head };
      if (this.rows.size >= KEEP_ROWS) this.rows.delete(this.rows.keys().next().value as string);
      this.rows.set(key, person);
      this.changed();
      return person;
    } catch {
      return null;
    } finally {
      this.building.delete(key);
    }
  }

  private enqueue(key: string, look: PersonLook, graded: boolean, priority: number): Job {
    const job: Job = { key, look, graded, priority, waiters: [] };
    this.jobs.set(key, job);
    void this.work();
    return job;
  }

  /** Builds what is queued, the most wanted first, giving the page a turn between rows. */
  private async work() {
    if (this.working) return;
    this.working = true;
    try {
      await this.yieldNow();       // not inside whatever asked: a render, a signal
      for (;;) {
        let best: Job | null = null;
        for (const j of this.jobs.values()) if (best === null || j.priority < best.priority) best = j;
        if (!best) break;
        let person: DrawnPerson | null = null;
        try { person = await this.build(best); } catch { person = null; }
        this.jobs.delete(best.key);
        if (person) {
          if (this.rows.size >= KEEP_ROWS) this.rows.delete(this.rows.keys().next().value as string);
          this.rows.set(best.key, person);
          this.changed();
        }
        best.waiters.forEach((w) => w(person));
        await this.yieldNow();
      }
    } finally {
      this.working = false;
    }
  }

  private async build(job: Job): Promise<DrawnPerson | null> {
    const pack = this.pack;
    if (!pack || typeof document === "undefined") return null;
    const look = known(pack.catalogue, job.look);
    const books = pack.catalogue.parts.books;
    const book = books.length ? books[stableHash(lookKey(look)) % books.length].id : null;
    await pack.load([...layerKeys(look), ...(book ? ["book/" + book] : [])]);
    const steps = composeRowSteps(pack.catalogue, look, pack.source, { book, graded: job.graded });
    let since = this.clock();
    let step = steps.next();
    while (!step.done) {
      if (this.clock() - since >= SLICE_MS) { await this.yieldNow(); since = this.clock(); }
      step = steps.next();
    }
    const data = step.value;
    if (!data) return null;
    const canvas = document.createElement("canvas");
    canvas.width = ROW_W; canvas.height = FRAME_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, ROW_W, FRAME_H), 0, 0);
    return { sheet: canvas, phones: look.phones !== null, look, frame: PERSON_FRAME, head: PERSON_HEAD };
  }
}

let shared: PeopleStore | null = null;
/** The page's one store: the layers are fetched once however many rooms and wardrobes ask. */
export function peopleStore(): PeopleStore { return (shared ??= new PeopleStore()); }

