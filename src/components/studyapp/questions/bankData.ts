"use client";

import { useCallback, useEffect, useState } from "react";
import { bankFile, subjectFile } from "@/lib/studyapp/questions/cropUrls";
import { cleanRows, cleanText, fold, type BankRow } from "@/lib/studyapp/questions/picker";
import { cleanMeta, type SubjectMeta } from "@/lib/studyapp/questions/subject";

/**
 * A subject's data, fetched when it is chosen and kept for the visit: its names and topics (a few KB), its parts
 * (`parts.json`, a few thousand short rows), and, only when someone searches, the papers' text (`text.json`, up to a megabyte).
 * Every file is checked on arrival (`cleanMeta`, `cleanRows`, `cleanText`): one that is not what it should be reads as
 * "did not load", with a way to try again, never as a crash.
 */
const metas = new Map<string, Promise<SubjectMeta>>();
const parts = new Map<string, Promise<BankRow[]>>();
const texts = new Map<string, Promise<Record<string, string>>>();

/** At most this many files in flight at once: four shelves asking together must not starve the one the student is looking at. */
const MAX_FLIGHT = 4;
let flying = 0;
const waiting: (() => void)[] = [];
function slot(): Promise<void> {
  if (flying < MAX_FLIGHT) { flying++; return Promise.resolve(); }
  return new Promise((go) => waiting.push(() => { flying++; go(); }));
}
const release = () => { flying--; waiting.shift()?.(); };
const json = (url: string): Promise<unknown> =>
  slot().then(() => fetch(url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).finally(release));
const once = <T,>(m: Map<string, Promise<T>>, key: string, make: () => Promise<T>) => {
  let p = m.get(key);
  if (!p) { p = make(); m.set(key, p); p.catch(() => m.delete(key)); }
  return p;
};

export type Loaded = { state: "loading" } | { state: "error" } | { state: "ready"; meta: SubjectMeta; rows: BankRow[] };

/** The subject's data if it has already arrived this visit (a shelf that was scrolled past, a picker opened from it): no waiting. */
export const loadedSubject = new Map<string, { meta: SubjectMeta; rows: BankRow[] }>();

/**
 * `attempt` is bumped to try again: the answer for an older attempt reads as loading, so a retry is seen to be running.
 * `enabled` false holds the fetch back (a shelf below the fold asks only when it is nearly seen).
 */
export function useSubject(slug: string | null, attempt = 0, enabled = true): Loaded {
  const [got, setGot] = useState<{ slug: string; attempt: number; res: { meta: SubjectMeta; rows: BankRow[] } | null } | null>(null);
  useEffect(() => {
    if (!slug || !enabled) return;
    let live = true;
    Promise.all([once(metas, slug, () => json(subjectFile(slug)).then(cleanMeta)), once(parts, slug, () => json(bankFile(slug, "parts")).then(cleanRows))])
      .then(([meta, rows]) => { loadedSubject.set(slug, { meta, rows }); if (live) setGot({ slug, attempt, res: { meta, rows } }); })
      .catch(() => { if (live) setGot({ slug, attempt, res: null }); });
    return () => { live = false; };
  }, [slug, attempt, enabled]);
  if (slug && (!got || got.slug !== slug)) { const hit = loadedSubject.get(slug); if (hit) return { state: "ready", ...hit }; }
  if (!slug || !got || got.slug !== slug || got.attempt !== attempt) return { state: "loading" };
  return got.res ? { state: "ready", ...got.res } : { state: "error" };
}

export interface BankText {
  /** The papers' text, folded for searching; null until it has arrived. */
  text: Record<string, string> | null;
  /** It did not arrive (after one quiet second try): searching is by titles only. */
  failed: boolean;
  retry(): void;
}

/** The papers' full text, folded for searching, once `wanted` (someone has typed). Folded in slices so the page stays responsive. */
export function useBankText(slug: string | null, wanted: boolean): BankText {
  const [got, setGot] = useState<{ slug: string; text: Record<string, string> } | null>(null);
  const [tries, setTries] = useState(0);
  const [failedAt, setFailedAt] = useState<{ slug: string; tries: number } | null>(null);
  useEffect(() => {
    if (!slug || !wanted) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    once(texts, slug, async () => {
      const raw = cleanText(await json(bankFile(slug, "text")));
      const out: Record<string, string> = Object.create(null);
      const keys = Object.keys(raw);
      for (let i = 0; i < keys.length; i += 400) {
        for (const k of keys.slice(i, i + 400)) out[k] = fold(raw[k]);
        await new Promise((r) => setTimeout(r, 0));
      }
      return out;
    })
      .then((text) => { if (live) setGot({ slug, text }); })
      .catch(() => {
        if (!live) return;
        if (tries === 0) timer = setTimeout(() => { if (live) setTries(1); }, 1500);   // one quiet second go
        else setFailedAt({ slug, tries });
      });
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [slug, wanted, tries]);
  const retry = useCallback(() => { setFailedAt(null); setTries((t) => t + 1); }, []);
  const text = got && got.slug === slug ? got.text : null;
  return { text, failed: !text && !!failedAt && failedAt.slug === slug && failedAt.tries === tries, retry };
}
