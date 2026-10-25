"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import type { BankPart, BankSubject } from "@/content/questionBank";

/** The most one set (or one download by number) holds: a long practice session's worth, picked by hand. */
export const SET_MAX = 150;

/**
 * "My set": the questions someone has picked, kept in this browser between visits.
 * No account: storage can be missing (private windows), so every access is guarded
 * and the set simply starts empty when it is.
 */
export function useQuestionSet(slug: string) {
  const key = `plumi-bank-set:${slug}`;
  const raw = useSyncExternalStore(subscribeStorage, () => readStorage(key), () => "[]");
  const ids = useMemo<string[]>(() => { try { return JSON.parse(raw); } catch { return []; } }, [raw]);
  const save = useCallback((next: string[]) => writeStorage(key, JSON.stringify(next)), [key]);
  const inSet = useMemo(() => new Set(ids), [ids]);
  return {
    ids,
    has: (id: string) => inSet.has(id),
    full: ids.length >= SET_MAX,
    toggle: (id: string) => {
      if (inSet.has(id)) return save(ids.filter(x => x !== id));
      if (ids.length >= SET_MAX) return;
      track("bank_set_added", { subject: slug, size: ids.length + 1 });
      save([...ids, id]);
    },
    clear: () => save([]),
    restore: (next: string[]) => save(next),
  };
}

/** A tiny store over localStorage, with an in-memory fallback when storage is unavailable. */
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
function readStorage(key: string) {
  try { return localStorage.getItem(key) ?? memory.get(key) ?? "[]"; } catch { return memory.get(key) ?? "[]"; }
}
function writeStorage(key: string, value: string) {
  memory.set(key, value);
  try { localStorage.setItem(key, value); } catch { /* storage unavailable: memory only */ }
  listeners.forEach(l => l());
}
function subscribeStorage(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

export type QuestionSet = ReturnType<typeof useQuestionSet>;

/**
 * The tray along the bottom once a question is in the set: how many, download
 * them as one PDF (in paper order, each question's start included, mark schemes
 * at the back), see or trim what's in it, or start again (with an undo).
 * The PDF is built here in the browser, so there is no sign-in and no wait on a server.
 */
export function SetTray({ subject, set, parts }: { subject: BankSubject; set: QuestionSet; parts: BankPart[] | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [withMs, setWithMs] = useState(true);
  const [undo, setUndo] = useState<string[] | null>(null);
  const [listOpen, setListOpen] = useState(false);
  if (!set.ids.length && !undo) return null;

  if (!set.ids.length && undo) {
    return (
      <div className="qb-tray" role="region" aria-label="Your question set">
        <div className="qb-tray-inner lp-card">
          <p className="qb-tray-count">Set cleared.</p>
          <button type="button" className="lp-btn qb-tray-go" onClick={() => { set.restore(undo); setUndo(null); }}>Undo</button>
        </div>
      </div>
    );
  }

  const chosen = parts ? set.ids.map(id => parts.find(p => p.id === id)).filter((p): p is BankPart => !!p) : [];
  const marks = chosen.reduce((n, p) => n + (p.m ?? 0), 0);
  const count = set.ids.length;

  async function download() {
    setNote(null);
    setBusy("Building…");
    try {
      const { buildSetPdf } = await import("@/lib/questionSetPdf");
      const skipped = await buildSetPdf(subject, chosen, { markSchemes: withMs, onProgress: (done, total) => setBusy(`Adding ${done} of ${total}…`) });
      track("bank_pdf_downloaded", { subject: subject.slug, questions: chosen.length, mark_schemes: withMs });
      setNote(skipped ? `Saved ✓ (${skipped} couldn’t be added)` : "Saved ✓");
    } catch {
      setNote("Couldn’t build it. Try again?");
    } finally {
      setBusy(null);
    }
  }

  function clear() {
    const before = set.ids;
    set.clear();
    setUndo(before);
    setTimeout(() => setUndo(null), 6000);
  }

  return (
    <div className="qb-tray" role="region" aria-label="Your question set">
      <div className="qb-tray-inner lp-card">
        <button type="button" className="qb-tray-count" aria-expanded={listOpen} onClick={() => setListOpen(o => !o)}>
          <strong>{count}</strong> {count === 1 ? "question" : "questions"}{marks ? <span> · {marks} {marks === 1 ? "mark" : "marks"}</span> : null}
          <span className="qb-tray-caret" aria-hidden="true">{listOpen ? "−" : "+"}</span>
        </button>
        <button type="button" className="lp-btn qb-tray-go" onClick={download} disabled={!!busy || !parts}>{busy ?? (parts ? "Download PDF" : "Loading…")}</button>
        {note && <p className="qb-tray-note" role="status">{note}</p>}
        {count >= SET_MAX && !note && <p className="qb-tray-note" role="status">That’s {SET_MAX}, the most one set holds. Download it, then clear it for the next.</p>}
        {listOpen && (
          <div className="qb-tray-list">
            <label className="qb-tray-ms"><input type="checkbox" checked={withMs} onChange={e => setWithMs(e.target.checked)} /> Mark schemes at the back</label>
            <ol>
              {chosen.map(p => (
                <li key={p.id}>
                  <span>{subject.series.find(s => s.id === p.s)?.label} · {subject.papers.find(x => x.id === p.p)?.name} · Q{p.l}</span>
                  <button type="button" className="qb-link" onClick={() => set.toggle(p.id)} aria-label={`Remove question ${p.l}`}>Remove</button>
                </li>
              ))}
            </ol>
            <button type="button" className="qb-link" onClick={clear} disabled={!!busy}>Clear the set</button>
          </div>
        )}
      </div>
    </div>
  );
}
