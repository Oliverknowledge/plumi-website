"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { heldClears, offerLabel, settle, TEXT_WAIT_MS } from "@/lib/studyapp/questions/feedSettle";

export interface Settled<T> {
  /** The list on screen: null only before the first one is ready (a search remembered from last time, waiting for the papers' text for up to 2.5 s). */
  list: readonly T[] | null;
  /** Changes when a different list is put on screen (a new search or filter, or "Show them"): the page goes back to its top then, never otherwise. */
  epoch: number;
  /** The student's new search is waiting for the papers' text: the old list stays, dimmed. */
  waiting: boolean;
  /** A late change was held because the student is reading further down: what the chip says (null: nothing held). */
  offer: string | null;
  show(): void;
}

/**
 * The list the student is looking at never changes or jumps under them unless they changed a filter or the search (feedSettle.ts has the rule). `candidate` is the list the data now
 * gives; `intent` says what the student has chosen (it changes in the same render as `candidate` does when they choose); `waitingForText` is a search whose papers' text has not arrived.
 */
/** The keyboard is in a card of the list on screen. */
const focusInList = () => !!document.activeElement?.closest?.(".qf-list");

export function useSettledList<T extends { id: string }>(candidate: readonly T[], intent: string, waitingForText: boolean, holdFirst: boolean): Settled<T> {
  const [shown, setShown] = useState<{ list: readonly T[]; intent: string; epoch: number } | null>(() => (holdFirst ? null : { list: candidate, intent, epoch: 0 }));
  const [offer, setOffer] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const waitFrom = useRef<number | null>(null);
  const latest = useRef({ candidate, intent });
  useEffect(() => { latest.current = { candidate, intent }; });

  useEffect(() => {
    if (shown && candidate === shown.list && intent === shown.intent) { waitFrom.current = null; return; }
    const intentChanged = !shown || intent !== shown.intent;
    if (intentChanged && waitingForText && waitFrom.current === null) waitFrom.current = Date.now();
    const waited = waitFrom.current === null ? 0 : Date.now() - waitFrom.current;
    const act = shown
      ? settle({ shownIds: shown.list.map((x) => x.id), nextIds: candidate.map((x) => x.id), intentChanged, waitingForText, waitedMs: waited, scrollY: window.scrollY, viewportH: window.innerHeight, focusInside: focusInList() })
      : waitingForText && (waited < TEXT_WAIT_MS || candidate.length === 0) ? "wait" : "apply";
    if (act === "wait") {
      // (after the 2.5 s an empty list keeps waiting for the text itself: nothing to time, the text arriving or failing re-runs this)
      if (waited >= TEXT_WAIT_MS) return;
      const t = setTimeout(() => setTick((n) => n + 1), TEXT_WAIT_MS - waited);
      return () => clearTimeout(t);
    }
    waitFrom.current = null;
    if (act === "offer" && shown) { setOffer(offerLabel(shown.list.length, candidate.length)); return; }
    setShown({ list: candidate, intent, epoch: (shown?.epoch ?? 0) + (act === "apply" && shown && intentChanged ? 1 : 0) });
    setOffer(null);
  }, [candidate, intent, waitingForText, shown, tick]);

  // A held list goes in quietly when the student comes back to the top of the page (and is not typing in a card): the chip then goes.
  useEffect(() => {
    if (!offer) return;
    const on = () => {
      if (!heldClears(window.scrollY, focusInList())) return;
      const l = latest.current;
      setShown((s) => ({ list: l.candidate, intent: l.intent, epoch: s?.epoch ?? 0 }));
      setOffer(null);
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [offer]);

  const show = useCallback(() => {
    const l = latest.current;
    setShown((s) => ({ list: l.candidate, intent: l.intent, epoch: (s?.epoch ?? 0) + 1 }));
    setOffer(null);
  }, []);
  return { list: shown ? shown.list : null, epoch: shown?.epoch ?? 0, waiting: !!shown && intent !== shown.intent && waitingForText && !offer, offer, show };
}
