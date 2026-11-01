import { FOX_H, FOX_ROW_W, FOX_URL, FOX_W, composeFox, type Box } from "./fox";
import { LayerPack } from "./layers";
import { decodePng, type Bitmap } from "./png";
import { lookKey, personOf, stableHash, known, type AvatarKeys, type PeopleCatalogue, type PersonLook } from "./look";
import { FRAME_H, ROW_W, composeRow, layerKeys } from "./sheet";

/**
 * The browser side of the people: fetches the app's layers once (only where this is used, never the homepage), and
 * hands out each person's 78-frame row as a canvas, built when first asked for and cached per distinct look. Asking
 * is synchronous and cheap: a row that is not ready yet answers null (the room keeps the premade person) and tells
 * subscribers when it is. Nothing here throws at a view; if the art cannot be had, every answer is null.
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
const BASE = "/library/";
const KEEP_ROWS = 80;
const RETRY_AFTER_MS = 30_000;

export interface PeopleFetch { (url: string): Promise<{ ok: boolean; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }> }

export class PeopleStore {
  private pack: LayerPack | null = null;
  private loading: Promise<boolean> | null = null;
  private failedAt = -Infinity;
  private rows = new Map<string, DrawnPerson>();
  private building = new Set<string>();
  private listeners = new Set<() => void>();

  constructor(private get: PeopleFetch = (u) => fetch(u), private now: () => number = Date.now) {}

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
        const [cj, bj] = await Promise.all([this.get(BASE + "people-layers.json"), this.get(BASE + "people-layers.bin")]);
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

  /** A drawn person if it is ready; changes nothing and starts nothing (for a render). */
  peek(look: PersonLook | null, graded = true): DrawnPerson | null {
    return look ? this.rows.get(lookKey(look) + (graded ? "" : "#plain")) ?? null : null;
  }

  /** The drawn person for a look: ready now, or null (and on its way: subscribers are told). */
  row(look: PersonLook | null, graded = true): DrawnPerson | null {
    if (!look) return null;
    const key = lookKey(look) + (graded ? "" : "#plain");
    const hit = this.rows.get(key);
    if (hit) { this.rows.delete(key); this.rows.set(key, hit); return hit; }
    if (look.species) { if (!this.building.has(key)) void this.buildAnimal(key, look, graded); return null; }
    if (this.pack && !this.building.has(key)) void this.build(key, look, graded);
    else if (!this.pack) void this.ready();
    return null;
  }

  /** Builds a look's row and waits for it (the room waits a moment for you before it opens, so you are not seen changing). */
  async make(look: PersonLook, graded = true): Promise<DrawnPerson | null> {
    if (!(await this.ready())) return null;
    const key = lookKey(look) + (graded ? "" : "#plain");
    return this.rows.get(key) ?? (await (look.species ? this.buildAnimal(key, look, graded) : this.build(key, look, graded)));
  }

  private strip: Promise<Bitmap | null> | null = null;
  private stripFailedAt = -Infinity;
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

  private async build(key: string, input: PersonLook, graded: boolean): Promise<DrawnPerson | null> {
    const pack = this.pack;
    if (!pack || typeof document === "undefined") return null;
    this.building.add(key);
    try {
      const look = known(pack.catalogue, input);
      const books = pack.catalogue.parts.books;
      const book = books.length ? books[stableHash(lookKey(look)) % books.length].id : null;
      await pack.load([...layerKeys(look), ...(book ? ["book/" + book] : [])]);
      const data = composeRow(pack.catalogue, look, pack.source, { book, graded });
      if (!data) return null;
      const canvas = document.createElement("canvas");
      canvas.width = ROW_W; canvas.height = FRAME_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, ROW_W, FRAME_H), 0, 0);
      const person: DrawnPerson = { sheet: canvas, phones: look.phones !== null, look, frame: PERSON_FRAME, head: PERSON_HEAD };
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
}

let shared: PeopleStore | null = null;
/** The page's one store: the layers are fetched once however many rooms and wardrobes ask. */
export function peopleStore(): PeopleStore { return (shared ??= new PeopleStore()); }

