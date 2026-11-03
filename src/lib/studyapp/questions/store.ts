"use client";

import { changeQuestions, currentQuestions, useApp } from "../store";
import { removeInk, removeSetInk } from "./inkDb";
import {
  checkPart, createSet, deleteSet, finishSet, keyOf, markPart, openSet, redoInput, renameSet, reopenSet, resetPart, setAt, setHeight, setInkMeta, setMode, setPick, setPrefs, setText,
  type Mode, type QPrefs, type QuestionsData, type SetInput,
} from "./model";

/** The Questions tab's data from the app's store (device only), and the changes to it. Each is one pure function from model.ts. */
export function useQuestions(): { ready: boolean; persisted: boolean; q: QuestionsData } {
  const s = useApp();
  return { ready: s.ready, persisted: s.persisted, q: s.data.questions };
}

const now = () => Date.now();

export const qa = {
  /** Make a set from chosen parts and put it on the desk. Ink of any set pushed out by the cap is deleted. */
  start(input: SetInput): string {
    let id = "";
    let dropped: string[] = [];
    changeQuestions((q) => { const r = createSet(q, input, now()); id = r.id; dropped = r.dropped; return r.q; });
    for (const d of dropped) void removeSetInk(d);
    return id;
  },
  open: (id: string | null) => changeQuestions((q) => openSet(q, id)),
  remove(id: string) { changeQuestions((q) => deleteSet(q, id)); void removeSetInk(id); },
  rename: (id: string, name: string) => changeQuestions((q) => renameSet(q, id, name)),
  at: (id: string, at: number) => changeQuestions((q) => setAt(q, id, at)),
  /** Typed answer. False if it did not all fit (the part's or the device's cap). */
  text(setId: string, partId: string, text: string): boolean {
    let ok = true;
    changeQuestions((q) => { const r = setText(q, setId, partId, text, now()); ok = r.ok; return r.q; });
    return ok;
  },
  mode: (setId: string, partId: string, mode: Mode) => changeQuestions((q) => setMode(q, setId, partId, mode, now())),
  height: (setId: string, partId: string, h: number) => changeQuestions((q) => setHeight(q, setId, partId, h, now())),
  ink: (setId: string, partId: string, n: number, bytes: number) => changeQuestions((q) => setInkMeta(q, setId, partId, n, bytes, now())),
  check: (setId: string, partId: string) => changeQuestions((q) => (q.answers[keyOf(setId, partId)]?.chk ? q : checkPart(q, setId, partId, now()))),
  mark: (setId: string, partId: string, got: number | null) => changeQuestions((q) => markPart(q, setId, partId, got, now())),
  /** Clear a part's answer. (Its ink is cleared by its zone, which also keeps the undo.) */
  reset(setId: string, partId: string) { changeQuestions((q) => resetPart(q, setId, partId, now())); },
  finish: (id: string) => changeQuestions((q) => finishSet(q, id, now())),
  reopen: (id: string) => changeQuestions((q) => reopenSet(q, id)),
  pick: (subject: string | null, topics: readonly string[]) => changeQuestions((q) => setPick(q, subject, topics)),
  prefs: (p: Partial<QPrefs>) => changeQuestions((q) => setPrefs(q, p)),
  /** A redo set of the parts that lost marks, or null if none did. */
  redo(setId: string): string | null {
    const q = currentQuestions();
    const set = q.sets.find((s) => s.id === setId);
    const input = set ? redoInput(set, q.answers) : null;
    return input ? qa.start(input) : null;
  },
  /** Ink of one answer, deleted from the device (when a part is reset from outside its zone). */
  dropInk: (setId: string, partId: string) => removeInk([keyOf(setId, partId)]),
};
