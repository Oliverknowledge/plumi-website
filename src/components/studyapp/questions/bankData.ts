"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bankFile, subjectFile, type BankFileName } from "@/lib/studyapp/questions/cropUrls";
import { cleanRows, cleanText, fold, type BankRow } from "@/lib/studyapp/questions/picker";
import { FEED_KEY } from "@/lib/studyapp/questions/feedView";
import { QUESTIONS_KEY } from "@/lib/studyapp/questions/persist";
import { useQuestionsValue } from "@/lib/studyapp/questions/store";
import { NO_EXTRAS, type FeedExtras } from "@/lib/studyapp/questions/feed";
import { cleanMeta, paperKeeps, tierLine, tiersOf, type SubjectMeta } from "@/lib/studyapp/questions/subject";

/**
 * A subject's data, fetched when it is chosen and kept for the visit: its names and topics (a few KB), its parts
 * (`parts.json`, a few thousand short rows), and, only when someone searches, the papers' text (`text.json`, up to a megabyte).
 * Every file is checked on arrival (`cleanMeta`, `cleanRows`, `cleanText`): one that is not what it should be reads as
 * "did not load", with a way to try again, never as a crash.
 */
const metas = new Map<string, Promise<SubjectMeta>>();
const parts = new Map<string, Promise<BankRow[]>>();
const texts = new Map<string, Promise<Record<string, string>>>();
/** A subject's folded text once it has arrived this visit (read without asking for it: nothing is fetched by reading this). */
const arrived = new Map<string, Record<string, string>>();
export const loadedText = (slug: string | null | undefined): Record<string, string> | null => (slug ? arrived.get(slug) ?? null : null);

/** At most this many files in flight at once: four shelves asking together must not starve the one the student is looking at. */
const MAX_FLIGHT = 4;
let flying = 0;
const waiting: (() => void)[] = [];
function slot(): Promise<void> {
  if (flying < MAX_FLIGHT) { flying++; return Promise.resolve(); }
  return new Promise((go) => waiting.push(() => { flying++; go(); }));
}
const release = () => { flying--; waiting.shift()?.(); };
/** A file that has not arrived in this long is treated as failed (the shelf then says so and offers Try again), so a stalled request can never leave a shelf on its placeholders for good. */
export const FETCH_TIMEOUT_MS = 15_000;
function timeoutSignal(ms: number): { signal: AbortSignal; done(): void } {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}
/**
 * The subject the student was last in (the feed opens on it) is asked for as soon as this file is loaded, which is when the Questions page's code arrives (on a
 * hard load before the app has started, on a tap on the tab as the page is being made): the promises wait here for the first asker, so the questions are on their way
 * while the app starts and are not asked for twice. It reads only what this device remembers; no student, no subject or a failure is nothing, and a promise that
 * fails is as if it had not been made (the file is asked for in the usual way, with its timeout and its retry).
 */
const early = new Map<string, Promise<unknown>>();
function warmLast() {
  try {
    const f = JSON.parse(localStorage.getItem(FEED_KEY) ?? "null") ?? {};
    const d = JSON.parse(localStorage.getItem(QUESTIONS_KEY) ?? "null");
    const mine: unknown = d?.q?.mine;
    if (!Array.isArray(mine)) return;
    const slug = typeof f.last === "string" && mine.includes(f.last) ? f.last : mine[0];
    if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug) || f.view?.[slug] === "papers") return;
    // The subject's meta first (it carries the hashes that name the data files on R2), the parts list the moment it arrives: two requests, one after the other, started before the app has.
    const ask = (url: string) => {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), FETCH_TIMEOUT_MS);
      const p = fetch(url, { signal: c.signal }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<unknown>; }).finally(() => clearTimeout(t));
      p.catch(() => undefined);
      return p;
    };
    const metaUrl = subjectFile(slug);
    const mp = ask(metaUrl);
    early.set(metaUrl, mp);
    const pp = mp.then((m) => { const url = bankFile(slug, (m as { data?: Record<string, string> } | null)?.data, "parts"); if (!url) throw new Error("no parts list"); return ask(url); });
    pp.catch(() => undefined);
    early.set(`parts:${slug}`, pp);
  } catch { /* nothing remembered, or storage is blocked */ }
}
if (typeof window !== "undefined") warmLast();
const json = (url: string, key = url): Promise<unknown> => {
  const p = early.get(key);
  early.delete(key);
  return p ? p.catch(() => fetched(url)) : fetched(url);
};
/** A subject's meta, once per visit (a failure is forgotten, so a retry asks again). */
export const getMeta = (slug: string): Promise<SubjectMeta> => once(metas, slug, () => json(subjectFile(slug)).then(cleanMeta));
/** A subject's data file (`parts`, `text`, `reports`) from R2 by its hash, or null where the subject has none (the caller degrades calmly). */
export const getData = (slug: string, file: BankFileName): Promise<unknown | null> =>
  getMeta(slug).then((m) => { const url = bankFile(slug, m.data, file); return url ? json(url, file === "parts" ? `parts:${slug}` : url) : null; });
const fetched = (url: string): Promise<unknown> =>
  slot().then(() => {
    const t = timeoutSignal(FETCH_TIMEOUT_MS);
    return fetch(url, { signal: t.signal }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).finally(() => { t.done(); release(); });
  });
const once = <T,>(m: Map<string, Promise<T>>, key: string, make: () => Promise<T>) => {
  let p = m.get(key);
  if (!p) { p = make(); m.set(key, p); p.catch(() => m.delete(key)); }
  return p;
};

export type Loaded =
  | { state: "loading" }
  | { state: "error" }
  /** `meta.papers` and `rows` are already narrowed to the tier the student sits in this subject (`tier`, "Higher", or null for both): nothing downstream filters again. */
  | { state: "ready"; meta: SubjectMeta; rows: BankRow[]; tier: string | null };

/** The subject's data if it has already arrived this visit (a shelf that was scrolled past, a picker opened from it): no waiting. */
export const loadedSubject = new Map<string, { meta: SubjectMeta; rows: BankRow[] }>();

/**
 * `attempt` is bumped to try again: the answer for an older attempt reads as loading, so a retry is seen to be running.
 * `enabled` false holds the fetch back (a shelf below the fold asks only when it is nearly seen).
 */
export function useSubject(slug: string | null, attempt = 0, enabled = true): Loaded {
  const [got, setGot] = useState<{ slug: string; attempt: number; res: { meta: SubjectMeta; rows: BankRow[] } | null } | null>(null);
  const chosen = useQuestionsValue((q) => (slug ? q.tiers?.[slug]?.join("|") ?? "" : ""));
  useEffect(() => {
    if (!slug || !enabled) return;
    let live = true;
    // Try again: whatever was asked for before (and may be stuck) is let go, and a fresh request is made.
    if (attempt > 0) { metas.delete(slug); parts.delete(slug); }
    Promise.all([getMeta(slug), once(parts, slug, () => getData(slug, "parts").then((raw) => { if (raw === null) throw new Error("no parts list"); return cleanRows(raw); }))])
      .then(([meta, rows]) => { loadedSubject.set(slug, { meta, rows }); if (live) setGot({ slug, attempt, res: { meta, rows } }); })
      .catch(() => { if (live) setGot({ slug, attempt, res: null }); });
    return () => { live = false; };
  }, [slug, attempt, enabled]);
  const raw = slug && (!got || got.slug !== slug) ? loadedSubject.get(slug) : got && got.slug === slug && got.attempt === attempt ? got.res : null;
  const narrowed = useMemo(() => (raw ? narrowToTier(raw.meta, raw.rows, chosen ? chosen.split("|") : []) : null), [raw, chosen]);
  if (narrowed) return { state: "ready", ...narrowed };
  if (!slug || !got || got.slug !== slug || got.attempt !== attempt) return { state: "loading" };
  return { state: "error" };
}

/** A subject's names and its papers' files (booklets, code, transcripts), for a place that has only the set: null until they arrive, and for good if they never do (the page then simply has no such links). */
export function useSubjectMeta(slug: string): SubjectMeta | null {
  const [got, setGot] = useState<{ slug: string; meta: SubjectMeta } | null>(null);
  useEffect(() => {
    if (loadedSubject.has(slug)) return;
    let live = true;
    getMeta(slug).then((meta) => { if (live) setGot({ slug, meta }); }).catch(() => undefined);
    return () => { live = false; };
  }, [slug]);
  return loadedSubject.get(slug)?.meta ?? (got?.slug === slug ? got.meta : null);
}

/** A subject's papers and rows for the tier the student sits (all of them if they sit both, or if the choice matches nothing). */
export function narrowToTier(meta: SubjectMeta, rows: BankRow[], chosen: readonly string[]): { meta: SubjectMeta; rows: BankRow[]; tier: string | null } {
  const all = tiersOf(meta.papers, meta.level);
  const tier = tierLine(chosen, all);
  if (!tier || !all.length) return { meta, rows, tier: null };
  const keep = new Set(meta.papers.filter((p) => paperKeeps(p, chosen)).map((p) => p.id.toLowerCase()));
  const known = new Set(meta.papers.map((p) => p.id.toLowerCase()));
  const kept = rows.filter((r) => keep.has(r.p.toLowerCase()) || !known.has(r.p.toLowerCase()));
  if (!kept.length) return { meta, rows, tier: null };
  return { meta: { ...meta, papers: meta.papers.filter((p) => paperKeeps(p, chosen)) }, rows: kept, tier };
}

interface ExtrasLoad { extras: FeedExtras; /** One of the files the subject has did not arrive (as opposed to a subject that has none): its filter cannot be offered or kept, and the student is told. */ failed: boolean }
const extras = new Map<string, Promise<ExtrasLoad>>();
/** The ids in a data file, or null where it is not a list of strings (or not there). */
const idSet = (raw: unknown): Set<string> | null => (Array.isArray(raw) ? new Set(raw.filter((x): x is string => typeof x === "string")) : null);
/** The bank's extra files for a subject: the practicals, the questions that need second-year content, and the Foundation parts a Higher paper prints too. A file the subject has none of is null; one that did not arrive is null and says so. */
const loadExtras = (meta: SubjectMeta): Promise<ExtrasLoad> => {
  const d = meta.data ?? {};
  let failed = false;
  const get = (file: "practicals" | "year13" | "tiers") => (d[file] ? getData(meta.slug, file).catch(() => { failed = true; return null; }) : Promise.resolve(null));
  return Promise.all([get("practicals"), get("year13"), get("tiers")]).then(([prac, y13, tiers]) => {
    const map = tiers && typeof tiers === "object" && !Array.isArray(tiers) ? new Map(Object.entries(tiers as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string")) : null;
    const pr = idSet(prac);
    return { extras: { practicals: pr && pr.size ? pr : null, year13: idSet(y13), twins: map && map.size ? map : null, forms: null }, failed };
  });
};

/**
 * What the subject's filters need beyond its parts: `ready` is false until the files have been asked for (a subject with none is ready at once). A file that does not arrive is asked for
 * again once after two seconds and whenever the window is focused again, and `failed` says so meanwhile (the page tells the student; a remembered filter is kept, not dropped).
 */
export function useBankExtras(meta: SubjectMeta | null): { ready: boolean; extras: FeedExtras; failed: boolean; retry(): void } {
  const slug = meta?.slug ?? null;
  const [got, setGot] = useState<{ slug: string; load: ExtrasLoad } | null>(null);
  const [tries, setTries] = useState(0);
  const needs = !!meta && !!(meta.data?.practicals || meta.data?.year13 || meta.data?.tiers);
  const failed = !!got && got.slug === slug && got.load.failed;
  useEffect(() => {
    if (!meta || !needs) return;
    let live = true;
    once(extras, meta.slug, () => loadExtras(meta)).then((x) => { if (live) setGot({ slug: meta.slug, load: x }); }).catch(() => { if (live) setGot({ slug: meta.slug, load: { extras: NO_EXTRAS, failed: true } }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- by subject, and again on a retry
  }, [slug, needs, tries]);
  const retry = useCallback(() => { if (slug) extras.delete(slug); setTries((t) => t + 1); }, [slug]);
  useEffect(() => {
    if (!failed) return;
    const t = tries === 0 ? setTimeout(retry, 2000) : null;
    window.addEventListener("focus", retry);
    return () => { if (t) clearTimeout(t); window.removeEventListener("focus", retry); };
  }, [failed, tries, retry]);
  if (!needs) return { ready: true, extras: NO_EXTRAS, failed: false, retry };
  return got && got.slug === slug ? { ready: true, extras: got.load.extras, failed: got.load.failed, retry } : { ready: false, extras: NO_EXTRAS, failed: false, retry };
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
      const got = await getData(slug, "text");
      // (a subject with no search text: searching reads the titles only, no error)
      const raw = got === null ? Object.create(null) as Record<string, string> : cleanText(got);
      const out: Record<string, string> = Object.create(null);
      const keys = Object.keys(raw);
      for (let i = 0; i < keys.length; i += 400) {
        for (const k of keys.slice(i, i + 400)) out[k] = fold(raw[k]);
        await new Promise((r) => setTimeout(r, 0));
      }
      arrived.set(slug, out);
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
