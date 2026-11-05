"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { offerLabel, settle, TEXT_WAIT_MS } from "@/lib/studyapp/questions/feedSettle";

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
      ? settle({ shownIds: shown.list.map((x) => x.id), nextIds: candidate.map((x) => x.id), intentChanged, waitingForText, waitedMs: waited, scrollY: window.scrollY, viewportH: window.innerHeight })
      : waitingForText && waited < TEXT_WAIT_MS ? "wait" : "apply";
    if (act === "wait") {
      const t = setTimeout(() => setTick((n) => n + 1), Math.max(0, TEXT_WAIT_MS - waited));
      return () => clearTimeout(t);
    }
    waitFrom.current = null;
    if (act === "offer" && shown) { setOffer(offerLabel(shown.list.length, candidate.length)); return; }
    setShown({ list: candidate, intent, epoch: (shown?.epoch ?? 0) + (act === "apply" && shown && intentChanged ? 1 : 0) });
    setOffer(null);
  }, [candidate, intent, waitingForText, shown, tick]);

  const show = useCallback(() => {
    const l = latest.current;
    setShown((s) => ({ list: l.candidate, intent: l.intent, epoch: (s?.epoch ?? 0) + 1 }));
    setOffer(null);
  }, []);
  return { list: shown ? shown.list : null, epoch: shown?.epoch ?? 0, waiting: !!shown && intent !== shown.intent && waitingForText, offer, show };
}
