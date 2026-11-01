"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SocialAvatar } from "@/lib/social/types";
import { peopleStore } from "@/lib/studyapp/library/people/store";
import type { PersonLook } from "@/lib/studyapp/library/people/look";
import {
  SLOTS, STARTER_LOOK, currentOutsideFree, isWorn, itemsIn, lookNow, mergeAvatar, randomLook, sameLook, saveLine, variants, withVariant, worn,
  type Item, type Slot,
} from "@/lib/studyapp/library/people/wardrobe";
import type { LibrarySocial } from "@/lib/studyapp/library/session";

/**
 * The wardrobe: the student dresses their person, and the library draws everyone as they dressed (people/). It offers
 * what the iPad gives from the first day (src/lib/studyapp/library/people/wardrobe.ts says why that and no more),
 * saves through `set_avatar` as a merge of the avatar they already have, and shows the person walking as they will be
 * seen. No words to type anywhere.
 */

const FRONT = 18, WALK_RIGHT = 24, WALK_FRONT = 42;

/** Draws frames of a built person onto a canvas, a few times a second; one still frame under reduced motion. */
function Figure({ look, scale, loop, rect, label }: { look: PersonLook | null; scale: number; loop: number; rect?: [number, number]; label?: string }) {
  const store = peopleStore();
  const drawn = useSyncExternalStore(store.subscribe, () => store.peek(look, false), () => null);
  const last = useRef<typeof drawn>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [sy, sh] = rect ?? [0, 32];
  useEffect(() => { if (look) store.row(look, false); }, [store, look]);
  useEffect(() => {
    if (drawn) last.current = drawn;
    const c = cv.current, d = drawn ?? last.current;
    if (!c || !d) return;
    const g = c.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    const paint = (i: number) => { g.clearRect(0, 0, c.width, c.height); g.drawImage(d.sheet, (loop + (i % 6)) * 16, sy, 16, sh, 0, 0, 16, sh); };
    paint(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const t = setInterval(() => paint(++i), 140);
    return () => clearInterval(t);
  }, [drawn, loop, sy, sh]);
  return <canvas ref={cv} width={16} height={sh} className="lb-fig" style={{ width: 16 * scale, height: sh * scale }} role="img" aria-label={label ?? "Your person"} />;
}

/** One choice, pictured on you. */
function Tile({ item, look, on, current, onPick }: { item: Item; look: PersonLook; on: boolean; current?: boolean; onPick: () => void }) {
  const head = item.slot !== "outfit" && item.slot !== "skin";
  return (
    <button type="button" className={`lb-wtile${on ? " is-on" : ""}`} aria-pressed={on} aria-label={current ? `Current ${item.slot === "glasses" ? "glasses" : item.slot}` : item.title} data-testid={`wear-${item.slot}-${item.value}`} onClick={onPick}>
      <Figure look={look} scale={head ? 3 : 2} loop={FRONT} rect={head ? [4, 16] : [0, 32]} label={item.title} />
      <span>{current ? "Current" : item.title}</span>
    </button>
  );
}

export function Wardrobe({ social, avatar, colour, me, onSaved }: {
  social: Pick<LibrarySocial, "setAvatar">;
  avatar: SocialAvatar | null;
  colour: number;
  me: string;
  onSaved: (avatar: Record<string, string>) => void;
}) {
  const store = peopleStore();
  const cat = useSyncExternalStore(store.subscribe, () => store.catalogue, () => null);
  useEffect(() => { void store.ready(); }, [store]);
  const [slot, setSlot] = useState<Slot>("hair");
  const [edit, setEdit] = useState<PersonLook | null>(null);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);

  if (!cat) return <section className="card lb-card lb-wardrobe" aria-label="Outfit"><p className="lb-hint">Opening the wardrobe</p></section>;

  const base = lookNow(cat, avatar, colour, me);
  const draft = edit ?? base;
  const changed = !sameLook(draft, base);
  const put = (next: PersonLook) => { setEdit(next); setLine(null); };
  const items = itemsIn(slot);
  const extra = currentOutsideFree(draft, slot);
  const colourSlot = slot === "hair" || slot === "outfit" ? slot : null;
  const colours = colourSlot ? variants(cat, draft, colourSlot) : [];

  async function save() {
    if (busy || !changed) return;
    setBusy(true); setLine(null);
    const merged = mergeAvatar(avatar, draft);
    const r = await social.setAvatar(merged);
    setBusy(false);
    if (r.ok) { setEdit(null); setLine("Saved. Everyone sees you like this"); onSaved(merged); }
    else setLine(saveLine(r.failure));
  }

  return (
    <section className="card lb-card lb-wardrobe" aria-label="Outfit" data-testid="wardrobe">
      <div className="lb-wstage">
        <div className="lb-wbig"><Figure look={draft} scale={7} loop={FRONT} label="You, standing" /></div>
        <div className="lb-wwalk" aria-hidden="true">
          <Figure look={draft} scale={4} loop={WALK_RIGHT} label="You, walking" />
          <Figure look={draft} scale={4} loop={WALK_FRONT} label="You, walking" />
        </div>
      </div>
      <div className="lb-wslots" role="tablist" aria-label="What to change">
        {SLOTS.map((s) => (
          <button key={s.slot} type="button" role="tab" aria-selected={slot === s.slot} className={slot === s.slot ? "on" : undefined} onClick={() => setSlot(s.slot)}>{s.title}</button>
        ))}
      </div>
      <div className="lb-wgrid" role="group" aria-label={SLOTS.find((s) => s.slot === slot)!.title}>
        {extra && <Tile item={extra} look={draft} on current onPick={() => {}} />}
        {items.map((it) => <Tile key={it.value} item={it} look={worn(cat, draft, it)} on={isWorn(it, draft)} onPick={() => put(worn(cat, draft, it))} />)}
      </div>
      {colourSlot && colours.length > 1 && (
        <div className="lb-wcols" role="group" aria-label={colourSlot === "hair" ? "Hair colour" : "Outfit colour"}>
          {colours.map((c) => {
            const on = (colourSlot === "hair" ? draft.hair : draft.outfit) === c.id;
            return <button key={c.id} type="button" className={`lb-swatch${on ? " is-on" : ""}`} style={{ background: c.colour }} aria-pressed={on} aria-label={`${colourSlot === "hair" ? "Hair" : "Outfit"} colour ${c.id.slice(3)}`} onClick={() => put(withVariant(cat, draft, colourSlot, c.id))} />;
          })}
        </div>
      )}
      <div className="lb-row lb-wact">
        <button type="button" className="btn gold" data-testid="save-outfit" disabled={!changed || busy} onClick={() => void save()}>{busy ? "Saving" : "Save"}</button>
        <button type="button" className="btn ghost" onClick={() => put(randomLook(cat))}>Random</button>
        <button type="button" className="btn ghost" onClick={() => put({ ...STARTER_LOOK })}>Reset</button>
      </div>
      <p className="lb-hint lb-wline" role="status" data-testid="outfit-line">{line ?? (changed ? "Not saved yet" : "More to wear is earned on iPad")}</p>
    </section>
  );
}
