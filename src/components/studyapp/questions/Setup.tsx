"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { choicesAt, draftKey, draftOf, draftSlugs, levelsOf, tickSubject, type SubjectChoice } from "@/lib/studyapp/questions/mine";
import { barLine, countAt, firstMissing, isMoreOpen, keptTier, levelHint, pileOf } from "@/lib/studyapp/questions/setupBooks";
import { baseSubject, sortTiers, type CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { DESK_ART, SETUP_ART } from "./BookArt";
import { BackIcon } from "./icons";
import { SetupBar } from "./SetupBar";
import { SetupBook } from "./SetupBook";
import "../../../app/study/(app)/questions-fixa.css";

/**
 * "What are you studying?": a stack of exercise books, one for each subject at the level they are looking at. Picking a book up ticks it; its exam
 * board (only the boards the bank has for it) is written on the cover, and the books they have picked pile up in the bar with the button.
 * Kept on the device (`qa.mine`). The first thing a new student sees; reached again with Change and Add a subject, with their choice
 * already ticked, and nothing is kept until they say Show my papers. (The looks are BookArt.tsx and questions-setup.css.)
 */
export function Setup({ catalogue, mine, tiers, first, onDone, onCancel }: {
  catalogue: CatalogueSubject[]; mine: string[]; tiers: Record<string, string[]>; first: boolean;
  /** `tiers` is the tier chosen for each ticked subject that has tiers, by slug (an empty list means both). */
  onDone(slugs: string[], tiers: Record<string, string[]>): void; onCancel(): void;
}) {
  const [draft, setDraft] = useState(() => draftOf(mine, catalogue));
  // The tier they sit, per ticked subject (by level and subject, so changing the board keeps it). Neither chip, or both, means both tiers.
  const [tierDraft, setTierDraft] = useState<Map<string, string[]>>(() => {
    const m = new Map<string, string[]>();
    for (const slug of mine) {
      const c = catalogue.find((x) => x.slug === slug);
      // A subject they already kept is theirs as it was: both tiers is "any tier", an answer, not a gap.
      const kept = c ? keptTier(tiers[slug], c.tiers) : null;
      if (c && kept) m.set(draftKey(c.level, baseSubject(c.subject)), kept);
    }
    return m;
  });
  const { main, other } = useMemo(() => levelsOf(catalogue), [catalogue]);
  const [level, setLevel] = useState(() => {
    const c = mine.length ? catalogue.find((x) => x.slug === mine[0]) : undefined;
    return c?.level ?? main[0] ?? other[0] ?? "GCSE";
  });
  /** The book whose choices are out (its draft key): one at a time, so the rest are quiet. */
  const [active, setActive] = useState<string | null>(null);
  /** The flap shows only the tier stickers (the board is chosen): small, so it covers little of what is below. */
  const [tierOnly, setTierOnly] = useState(false);
  const openFlap = (k: string | null, tiersOnly = false) => { setActive(k); setTierOnly(tiersOnly); if (k) setHint(null); };
  /** The one quiet hint about tiers (shown once, for a few seconds, on the book that was left at any tier). */
  const [hint, setHint] = useState<string | null>(null);
  const hinted = useRef(false);
  const showHint = (k: string) => { if (hinted.current) return; hinted.current = true; setHint(k); };
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(null), 7000);
    return () => window.clearTimeout(t);
  }, [hint]);
  /** Fold the flap away; a tier flap folded with no tier chosen leaves the book at any tier, which is said once. */
  const fold = () => {
    if (active && tierOnly && !tierDraft.get(active)?.length) showHint(active);
    openFlap(null);
  };
  const foldNow = useRef(fold);
  useEffect(() => { foldNow.current = fold; });
  /** A book on another level to take focus once that level is drawn (the bar sends them to the book that needs a board). */
  const goTo = useRef<string | null>(null);
  const choices = useMemo(() => choicesAt(catalogue, level), [catalogue, level]);
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus({ preventScroll: true }); }, []);

  const tiersOfSlug = (slug: string | undefined) => (slug ? catalogue.find((x) => x.slug === slug)?.tiers ?? [] : []);
  const toggle = (c: SubjectChoice) => {
    const k = draftKey(level, c.base);
    if (draft.has(k)) {
      const n = new Map(draft); n.delete(k); setDraft(n);
      if (active === k) openFlap(null);
      return;
    }
    const n = tickSubject(draft, level, c, catalogue);
    setDraft(n);
    // The choices come out where a board is still open; a tier (optional) is one tap on the cover's label, so it never covers the books below.
    const chosen = n.get(k);
    openFlap(!chosen || (tiersOfSlug(chosen).length >= 2 && !tierDraft.get(k)?.length) ? k : null, !!chosen);
  };
  const choose = (c: SubjectChoice, slug: string) => {
    const k = draftKey(level, c.base);
    setDraft((d) => new Map(d).set(k, slug));
    openFlap(tiersOfSlug(slug).length >= 2 && !(tierDraft.get(k)?.length) ? k : null, true);
  };
  /** One tier, or any (every tier): a choice, so the label stops asking. */
  const pickTier = (c: SubjectChoice, sel: string[]) => {
    const k = draftKey(level, c.base);
    setTierDraft((d) => new Map(d).set(k, sel));
    openFlap(null);
    if (sel.length === (tiersOfSlug(draft.get(k)).length)) showHint(k);
  };
  const missing = firstMissing(draft, level);
  const ready = draft.size > 0 && !missing;
  const pile = useMemo(() => pileOf(draft, catalogue), [draft, catalogue]);
  const line = barLine(draft, level);

  /** The choice for every ticked subject that has tiers, by slug. Both chosen is the same as none. */
  const done = () => {
    const out: Record<string, string[]> = {};
    for (const [k, slug] of draft) {
      const all = tiersOfSlug(slug);
      if (all.length < 2) continue;
      const sel = (tierDraft.get(k) ?? []).filter((t) => all.includes(t));
      out[slug] = sel.length === all.length ? [] : sortTiers(sel);
    }
    onDone(draftSlugs(draft), out);
  };
  /** Bring a book to the student: focus on it, and scroll it to the middle. False if it is not on screen. */
  const reveal = (k: string) => {
    const slot = [...document.querySelectorAll<HTMLElement>(".qk-slot")].find((el) => el.dataset.key === k);
    if (!slot) return false;
    slot.querySelector<HTMLElement>(".qk-cover")?.focus({ preventScroll: true });
    slot.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    return true;
  };
  /** The button before every board is chosen: it takes them to the first book that has none, with its choices out. */
  const fix = () => {
    if (!missing) return;
    const k = draftKey(missing.level, missing.base);
    openFlap(k);
    if (missing.level === level) { reveal(k); return; }
    goTo.current = k;
    setLevel(missing.level);
  };
  useEffect(() => {
    if (goTo.current && reveal(goTo.current)) goTo.current = null;
  }, [level]);

  // A tap anywhere but on the open book folds its choices away.
  useEffect(() => {
    if (!active) return;
    const away = (e: PointerEvent) => {
      const slot = (e.target as Element | null)?.closest?.(".qk-slot") as HTMLElement | null;
      if (slot?.dataset.key !== active) foldNow.current();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [active]);

  const changeLevel = (l: string) => { setLevel(l); openFlap(null); };
  const tab = (l: string) => (
    <button key={l} type="button" className={`qk-tab${l === level ? " on" : ""}`} aria-pressed={l === level} onClick={() => changeLevel(l)}>
      <span>{l}</span>{!main.includes(l) && levelHint(l) && <small className="qk-tab-hint">{levelHint(l)}</small>}{countAt(draft, l) > 0 && <span className="qk-tab-n" aria-label={`${countAt(draft, l)} chosen`}>{countAt(draft, l)}</span>}
    </button>
  );
  const otherN = other.reduce((n, l) => n + countAt(draft, l), 0);
  // More is raised, with its levels under it, only while one of those levels is the one on screen (a main level collapses it).
  const moreOpen = isMoreOpen(level, main, other);
  return (
    <main className="qs-page qk-setup" id="qs-main" data-testid="setup" aria-labelledby="qh-setup-h">
      <div className="qk-desk" aria-hidden="true">
        {DESK_ART.map(({ id, Art }) => <span key={id} className={`qk-d qk-d-${id}`}><Art /></span>)}
      </div>
      <div className="wrap">
        <div className="qk-col">
          {draft.size > 0 && (
            <a className="qs-skip" href="#qk-bar-go" onClick={(e) => { e.preventDefault(); document.getElementById("qk-bar-go")?.focus(); }}>Skip to Let&apos;s go</a>
          )}
          <header className="qk-head">
            <div className="qk-head-text">
              {!first && <button type="button" className="qs-homeback" onClick={onCancel} data-testid="setup-cancel"><BackIcon />Back</button>}
              <h1 id="qh-setup-h" ref={h1} tabIndex={-1}>What are you studying?</h1>
            </div>
            <div className="qk-mascot" aria-hidden="true">
              <p className="qk-bubble">{SETUP_ART.bubble}</p>
              <span className="qk-peek"><Image src={SETUP_ART.mascot} alt="" width={84} height={84} unoptimized priority /></span>
            </div>
          </header>

          <div className="qk-tabs" role="group" aria-label="Level">
            {main.map(tab)}
            {other.length > 0 && (
              <button type="button" className={`qk-tab qk-tab-more${moreOpen ? " open" : ""}`} aria-pressed={moreOpen} aria-expanded={moreOpen} onClick={() => { if (!moreOpen) changeLevel(other[0]); }}><span>More</span>{!moreOpen && otherN > 0 && <span className="qk-tab-n" aria-label={`${otherN} chosen`}>{otherN}</span>}</button>
            )}
          </div>
          {moreOpen && <div className="qk-tabs qk-tabs-more" role="group" aria-label="Other levels">{other.map(tab)}</div>}

          <ul className="qk-books" aria-label={`${level} subjects`}>
            {choices.map((c) => {
              const k = draftKey(level, c.base);
              const slug = draft.get(k);
              return (
                <SetupBook
                  key={c.base} choice={c} dataKey={k} slug={slug} tierOptions={tiersOfSlug(slug)} tierChosen={tierDraft.get(k)} open={active === k} tierOnly={tierOnly}
                  onToggle={() => toggle(c)} onBoard={(s) => choose(c, s)} onTier={(sel) => pickTier(c, sel)} onOpen={() => openFlap(k)} onClose={fold} hint={hint === k}
                />
              );
            })}
          </ul>
        </div>
      </div>

      {draft.size > 0 && <SetupBar pile={pile} line={line} ready={ready} onDone={done} onFix={fix} />}
    </main>
  );
}
