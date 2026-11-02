"use client";

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { colourOf } from "@/lib/library";
import { HEAD, headPx, scaleHead, type HeadSize } from "@/lib/studyapp/library/people/headCrop";
import { lookKey, personOf, type AvatarKeys } from "@/lib/studyapp/library/people/look";
import { peopleStore, type DrawnPerson } from "@/lib/studyapp/library/people/store";
import { FRAME_W } from "@/lib/studyapp/library/people/sheet";

/**
 * A person's HEAD in a rounded tile, in their colour: their front-facing idle frame cropped to the head and shoulders
 * (people/headCrop.ts), drawn from the SAME built row the room uses (`peopleStore()`, never a second copy of the art).
 *
 * HOW IT IS CACHED. A head is painted once per look and size: the 16 x 16 crop is read from the built row (1 KB), scaled
 * at a whole-number scale for this screen's device pixels (so it is crisp at 1x, 2x and 3x), and kept as a PNG data URL.
 * Every row, card and tile showing that look shares the string, so a list of 50 people is 50 <img>s over at most 50
 * small pictures, drawn once; nothing is repainted when the list updates. The URL cache holds 400 heads.
 *
 * WHILE IT IS NOT READY the tile is a quiet neutral placeholder; when the store says a row is built, the head
 * appears (`useSyncExternalStore`: no state set in an effect, nothing impure in render). If the layers never load,
 * the tile is their colour with the initial of their name.
 */

const FAILED = "!";
const KEEP_HEADS = 400;

const urls = new Map<string, string>();        // `${look}@${px}` -> PNG data URL
const crops = new Map<string, Uint8ClampedArray>();   // look -> its 16 x 16 head, so a second size does not read the row again
const asked = new Set<string>();               // looks whose row was asked for
const lost = new Set<string>();                // looks whose row could not be built
let artFailed = false;                          // the layers could not be fetched
let work: HTMLCanvasElement | null = null;
const own = new Set<() => void>();
const tell = () => own.forEach((f) => f());

const dpr = () => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);

function subscribe(cb: () => void) {
  const off = peopleStore().subscribe(cb);
  own.add(cb);
  window.addEventListener("resize", cb);       // zooming or moving to another screen changes the pixel ratio
  return () => { off(); own.delete(cb); window.removeEventListener("resize", cb); };
}

function remember<K, V>(m: Map<K, V>, k: K, v: V) {
  if (m.size >= KEEP_HEADS) m.delete(m.keys().next().value as K);
  m.set(k, v);
}

/** The picture for a look at `px` device pixels, made now from its built row. */
function paint(look: string, drawn: DrawnPerson, px: number): string {
  try {
    let crop = crops.get(look);
    if (!crop) {
      const ctx = drawn.sheet.getContext("2d");
      if (!ctx) return FAILED;
      crop = new Uint8ClampedArray(ctx.getImageData(HEAD.frame * FRAME_W + HEAD.x, HEAD.y, HEAD.w, HEAD.h).data);
      remember(crops, look, crop);
    }
    work ??= document.createElement("canvas");
    work.width = px; work.height = px;
    const ctx = work.getContext("2d");
    if (!ctx) return FAILED;
    ctx.putImageData(new ImageData(scaleHead(crop, px) as Uint8ClampedArray<ArrayBuffer>, px, px), 0, 0);
    const url = work.toDataURL("image/png");
    remember(urls, `${look}@${px}`, url);
    return url;
  } catch {
    return FAILED;
  }
}

/** What to show for this person now: "" (not ready), FAILED (will not come), or the picture. Only reads; starts nothing. */
function state(avatar: AvatarKeys | null | undefined, colour: number, id: string, px: number): string {
  const store = peopleStore();
  const cat = store.catalogue;
  if (!cat) return artFailed ? FAILED : "";
  const look = personOf(cat, avatar, colour, id);
  const key = lookKey(look);
  const hit = urls.get(`${key}@${px}`);
  if (hit) return hit;
  const drawn = store.peek(look);
  if (drawn) return paint(key, drawn, px);
  return lost.has(key) ? FAILED : "";
}

export function Head({ avatar, colour, id, size, label, name }: {
  avatar: AvatarKeys | null | undefined;
  colour: number;
  /** Their id, as the room keys them: someone with no avatar is the person their id makes (the same on every iPad). */
  id: string;
  size: HeadSize;
  /** The alt text. Leave it empty where the name is written next to the head. */
  label?: string;
  /** Whose initial to show if the art never loads (defaults to the label). */
  name?: string;
}) {
  const src = useSyncExternalStore(subscribe, () => state(avatar, colour, id, headPx(size, dpr())), () => "");

  // Start what is missing: the layers (once, for the whole page) and this person's row. A failure is remembered, quietly.
  useEffect(() => {
    const store = peopleStore();
    const look = store.lookOf(avatar, colour, id);
    if (!look) {
      void store.ready().then((ok) => { if (!ok && !store.catalogue) { artFailed = true; tell(); } });
      return;
    }
    const key = lookKey(look);
    if (asked.has(key) || store.peek(look)) return;
    asked.add(key);
    void store.make(look).then((d) => { if (!d && store.catalogue) { lost.add(key); tell(); } });
  }, [avatar, colour, id]);

  const letter = (name ?? label ?? "").trim().charAt(0).toUpperCase() || "?";
  const art = src !== "" && src !== FAILED;
  return (
    <span className={`lb-hd s${size}${src === "" ? " is-wait" : ""}`} style={{ "--hc": colourOf(colour) } as CSSProperties}
      role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}
      data-head={art ? "art" : src === FAILED ? "letter" : "wait"}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a cached data URL, drawn once per look; next/image would only get in the way */}
      {art && <img src={src} alt="" width={size} height={size} draggable={false} />}
      {src === FAILED && <b aria-hidden="true">{letter}</b>}
    </span>
  );
}
