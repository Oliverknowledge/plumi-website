"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { QAnswer, QPart } from "@/lib/studyapp/questions/model";
import { GAP_GUESS, columnShare, pagePx, pinKind, questionPx, unsplitWidth, zonePx, type PinMode } from "@/lib/studyapp/questions/split";
import { useSplitFlags } from "@/lib/studyapp/questions/feedStore";
import { useListWidth } from "./FeedList";

/** Where the strip at the top of the page ends (what a pinned question sticks under): said by the feed (Feed.tsx) whenever the strip changes. */
let feedGap = GAP_GUESS;
export const setFeedGap = (n: number) => { feedGap = n; };
export const readGap = (): number => feedGap;

/** The screen's size, as a store: a card reads it in the very render that needs it (a measure made after the render would draw the card twice). A tiny change of height (a browser bar) is not news. */
let vp = { w: 0, h: 0 };
const subs = new Set<() => void>();
const look = () => {
  const w = window.innerWidth, h = window.innerHeight;
  if (vp.w === w && Math.abs(vp.h - h) < 2) return false;
  vp = { w, h };
  return true;
};
const onResize = () => { if (look()) subs.forEach((f) => f()); };
function subscribe(cb: () => void) {
  if (!subs.size) { look(); window.addEventListener("resize", onResize); }
  subs.add(cb);
  return () => { subs.delete(cb); if (!subs.size) window.removeEventListener("resize", onResize); };
}
const snapshot = () => { if (!subs.size) look(); return vp; };
const SERVER = { w: 0, h: 0 };
const useViewport = () => useSyncExternalStore(subscribe, snapshot, () => SERVER);

export interface Pin {
  /** Pinning would help on this card (a tall question on this screen): the "Pin question" switch is offered. */
  eligible: boolean;
  /** What is drawn now: null when the student switched it off, or it would not help. */
  mode: PinMode | null;
  /** "Wider question" is on. */
  wide: boolean;
  /** Share of the sheet the question column takes (percent). */
  share: number;
  /** The least height of the working page (css px) while split. */
  page: number;
  /** The screen's width when this was decided. */
  vw: number;
}

const OFF: Pin = { eligible: false, mode: null, wide: false, share: 45, page: 0, vw: 0 };

/**
 * Says how one card is laid out while its answer space is shown (nothing is read otherwise): from the bank's picture sizes, the list's width (FeedList) and the screen, all in hand during the
 * render, so the card is drawn once, already split, in the commit that opens its space.
 */
export function usePin(opts: {
  shown: boolean;
  part: QPart;
  answer: QAnswer | undefined;
  stem: boolean;
  fig: QPart | null;
}): Pin {
  const { shown, part, answer, stem, fig } = opts;
  const flags = useSplitFlags();
  const listW = useListWidth();
  const v = useViewport();
  // What this card was a moment ago (hysteresis, split.ts): kept in state and adjusted in the render that changes it, so the card is still drawn once.
  const [was, setWas] = useState<PinMode | null>(null);

  const kind = useMemo<PinMode | null>(() => {
    if (!shown || listW <= 0 || v.w <= 0) return null;
    const u = unsplitWidth(listW, v.w);
    return pinKind({ viewportW: v.w, viewportH: v.h, questionPx: questionPx(part, u, { stem, fig }), zonePx: zonePx(part, answer, u), was });
  }, [shown, listW, v, part, answer, stem, fig, was]);
  const next = shown ? kind : null;
  if (next !== was) setWas(next);

  return useMemo<Pin>(() => {
    if (!kind) return OFF;
    const wide = !!flags.wide;
    return { eligible: true, mode: flags.off ? null : kind, wide, share: columnShare(wide), page: kind === "split" ? pagePx(v.h, readGap()) : 0, vw: v.w };
  }, [kind, flags.off, flags.wide, v]);
}
