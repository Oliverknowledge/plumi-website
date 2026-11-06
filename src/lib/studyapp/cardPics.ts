import { partImage, stemImage } from "./questions/cropUrls";

/**
 * A flashcard side that is a picture from the question bank (a "From my mistakes" card: the question on the front, the board's mark scheme on the back). The card
 * stores a small DESCRIPTOR, not a picture or a URL: the bank's part id, which of its pictures, and the crop version. The address is made when it is drawn
 * (`picUrl`), so a re-cut crop is fetched afresh, and nothing about the student's work is in it. Pure, and tested (cardPics.test.ts).
 *
 * A deck with picture cards is never shared: the pictures belong to the bank (and to the exam boards), not to the student, and a friend's device cannot
 * resolve them for a student who has not set the subject up. See `canShare` and `sharePayload` (sharing/payload.ts).
 */
export interface Pic {
  /** The bank part's id ("84631h-jun25-01-2"), or for a stem, the part that carries it. */
  id: string;
  /** The question picture, the start of the question (stem), or the mark scheme. */
  k: "qp" | "stem" | "ms";
  /** For a part that shares another's stem: the key of the stem it shares. */
  sk?: string;
  /** The bank's crop version for the subject (`QSet.cv`). */
  v?: number;
  /** What a screen reader says for the picture. */
  alt?: string;
}

/** The pictures of a card's two sides, in the order they are drawn, and the bank part the card is about (so a part is never made into a card twice). */
export interface CardPic { part?: string; f?: Pic[]; b?: Pic[] }

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{1,80}$/;
const MAX_PICS = 4;

function cleanPics(raw: unknown): Pic[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Pic[] = [];
  for (const p of raw.slice(0, MAX_PICS)) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    if (typeof o.id !== "string" || !ID.test(o.id) || (o.k !== "qp" && o.k !== "stem" && o.k !== "ms")) continue;
    const pic: Pic = { id: o.id, k: o.k };
    if (typeof o.sk === "string" && ID.test(o.sk)) pic.sk = o.sk;
    if (typeof o.v === "number" && Number.isInteger(o.v) && o.v > 0 && o.v < 1000) pic.v = o.v;
    if (typeof o.alt === "string") pic.alt = o.alt.slice(0, 160);
    out.push(pic);
  }
  return out.length ? out : undefined;
}

/** A card's `pic` as read from storage: anything not a valid descriptor is dropped (the card is then an ordinary text card). Old records have none. */
export function cleanCardPic(raw: unknown): CardPic | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const pic: CardPic = {};
  if (typeof o.part === "string" && ID.test(o.part)) pic.part = o.part;
  const f = cleanPics(o.f), b = cleanPics(o.b);
  if (f) pic.f = f;
  if (b) pic.b = b;
  return pic.f || pic.b || pic.part ? pic : undefined;
}

/** The address of a picture, made as the Questions tab makes it (cropUrls.ts). */
export function picUrl(p: Pic): string {
  return p.k === "stem" ? stemImage({ id: p.id, sk: p.sk }, p.v) : partImage(p.id, p.k, p.v);
}

/** Does this card have a picture on either side? */
export const hasPictures = (c: { pic?: CardPic } | null | undefined): boolean => !!c?.pic && !!(c.pic.f?.length || c.pic.b?.length);
