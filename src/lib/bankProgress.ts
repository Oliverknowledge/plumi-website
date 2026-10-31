"use client";

import { useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";

/**
 * Self-marking in the question bank: the marks a student gives themselves after
 * opening a mark scheme, kept in this browser between visits. No account yet, so
 * storage can be missing (private windows): every access is guarded and the
 * record simply starts empty when it is.
 *
 * One key holds every subject, so the streak and the days chart can count across
 * banks. Each part keeps its topic codes, so a topic's standing never waits on the
 * subject's parts list, and its last few attempts, so a topic remembers that you
 * got it wrong in March and right today. Each attempt is shaped as a future account
 * row (part, topics, score, out of, when), so keeping marks in an account later is a
 * copy, not a migration.
 */

const KEY = "plumi-bank-marks:v1";
/** Attempts kept per part: enough for a topic's recent run, small enough for localStorage. */
const KEEP = 6;
/** A second tap this soon after the first corrects that mark rather than counting as a new attempt. */
const CORRECTION_MS = 10 * 60 * 1000;

/**
 * One attempt: score, out of, when (ms), and what was picked: the letter for multiple
 * choice, or ROUGH for a "Got it / Partly / Missed" part, whose 2 is not a real mark.
 */
export type Attempt = [score: number, outOf: number, at: number, pick?: string];
export const ROUGH = "~";
export interface PartRecord { t: string[]; h: Attempt[] }
export type Store = { v: 1; subjects: Record<string, Record<string, PartRecord>> };

const EMPTY: Store = { v: 1, subjects: {} };

/* A tiny store over localStorage, with an in-memory fallback when storage is unavailable. */
let memory: string | null = null;
const listeners = new Set<() => void>();
function readRaw() {
  try { return localStorage.getItem(KEY) ?? memory ?? ""; } catch { return memory ?? ""; }
}
function writeRaw(value: string) {
  memory = value;
  try { localStorage.setItem(KEY, value); } catch { /* storage unavailable: memory only */ }
  listeners.forEach(l => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}
/** Parsed once per change, however many rows are reading it. */
let parsed: { raw: string; store: Store } = { raw: "", store: EMPTY };
function parse(raw: string): Store {
  if (raw === parsed.raw) return parsed.store;
  let store = EMPTY;
  try {
    const s = JSON.parse(raw);
    if (s && s.v === 1 && typeof s.subjects === "object") store = s;
  } catch { /* unreadable: start again */ }
  parsed = { raw, store };
  return store;
}

/** Every subject's marks, read live: any tab's change shows in every other. */
export function useBankMarks() {
  return parse(useSyncExternalStore(subscribe, readRaw, () => ""));
}

export interface MarkInput { subject: string; part: string; topics: string[]; score: number; outOf: number; kind: "marks" | "rough" | "choice"; choice?: string }

/** Record (or correct) a mark. Returns nothing: every view reads the store. */
export function recordMark({ subject, part, topics, score, outOf, kind, choice }: MarkInput) {
  const store = parse(readRaw());
  const bank = { ...(store.subjects[subject] ?? {}) };
  const now = Date.now();
  const prev = bank[part];
  const h = prev ? [...prev.h] : [];
  const last = h[h.length - 1];
  const pick = kind === "rough" ? ROUGH : choice;
  const next: Attempt = pick ? [score, outOf, now, pick] : [score, outOf, now];
  if (last && now - last[2] < CORRECTION_MS) { next[2] = last[2]; h[h.length - 1] = next; }
  else h.push(next);
  bank[part] = { t: topics, h: h.slice(-KEEP) };
  writeRaw(JSON.stringify({ v: 1, subjects: { ...store.subjects, [subject]: bank } }));
  track("bank_self_marked", { subject, part, score, out_of: outOf, kind, attempts: h.length });
}

/** Take back the newest attempt on a part (an "undo" straight after marking). */
export function undoMark(subject: string, part: string) {
  const store = parse(readRaw());
  const bank = { ...(store.subjects[subject] ?? {}) };
  const prev = bank[part];
  if (!prev) return;
  const h = prev.h.slice(0, -1);
  if (h.length) bank[part] = { ...prev, h };
  else delete bank[part];
  writeRaw(JSON.stringify({ v: 1, subjects: { ...store.subjects, [subject]: bank } }));
}

/** The whole question a part belongs to: "74051-jun25-01" of "74051-jun25-01-4". */
const questionOfPart = (id: string) => id.split("-").slice(0, 3).join("-");

/**
 * Where a subject stands now: the newest attempt on each part. Rough parts ("Got it")
 * count towards topics but not towards marks, since their 2 was never on the paper.
 * `questions` counts whole questions, as the margin does, not parts.
 */
export function subjectTotals(bank: Record<string, PartRecord> | undefined) {
  let scored = 0, outOf = 0;
  const questions = new Set<string>();
  for (const [id, rec] of Object.entries(bank ?? {})) {
    const a = rec.h[rec.h.length - 1];
    if (!a) continue;
    questions.add(questionOfPart(id));
    if (a[3] === ROUGH) continue;
    scored += a[0]; outOf += a[1];
  }
  return { questions: questions.size, scored, outOf, share: outOf ? scored / outOf : null };
}

/** How a share of marks reads, judged on the percentage shown, so "62%" is never called less than 62. */
export const shareTone = (share: number) => {
  const pct = Math.round(share * 100);
  return pct >= 62 ? "is-good" : pct >= 40 ? "is-mid" : "is-low";
};

/* ── Standing: the app's topic map, worked out the app's way ─────────────── */

/**
 * The five states, in the app's words and order of urgency (TopicState in
 * PracticeSessionOffer.swift). A topic is red only after two weak answers: one bad
 * answer is a bad answer, two is a pattern.
 */
export type TopicState = "needs" | "developing" | "rusty" | "early" | "strong";
export const STATE_LABEL: Record<TopicState, string> = {
  needs: "Needs attention", developing: "Developing", rusty: "Rusty", early: "Too early to tell", strong: "Strong",
};
export const STATE_ORDER: TopicState[] = ["early", "needs", "rusty", "developing", "strong"];

/** The app's band edges (LearnerModel.band) and the age at which a strong topic reads as rusty. */
const WEAK_BELOW = 0.4;
const DEVELOPING_BELOW = 0.62;
const RUSTY_AFTER_DAYS = 21;
const DAY = 86_400_000;

/** `tried`: one good answer, not yet enough to colour the square, but no longer untouched. */
export interface Standing { state: TopicState; tried: boolean; estimate: number | null; attempts: number; scored: number; outOf: number; lastAt: number | null }

/**
 * A topic's standing from its attempts. The estimate is a recent-weighted share of
 * the marks (each older attempt counts three quarters as much as the one after it),
 * so getting a topic right lately outweighs getting it wrong a month ago.
 */
export function standing(attempts: Attempt[], now = Date.now()): Standing {
  if (!attempts.length) return { state: "early", tried: false, estimate: null, attempts: 0, scored: 0, outOf: 0, lastAt: null };
  const sorted = [...attempts].sort((a, b) => a[2] - b[2]);
  let w = 1, sum = 0, weights = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const [s, of] = sorted[i];
    if (of > 0) { sum += (s / of) * w; weights += w; }
    w *= 0.75;
  }
  const estimate = weights ? sum / weights : 0;
  const lastAt = sorted[sorted.length - 1][2];
  const real = sorted.filter(a => a[3] !== ROUGH);
  const scored = real.reduce((n, a) => n + a[0], 0);
  const outOf = real.reduce((n, a) => n + a[1], 0);
  const n = sorted.length;
  let state: TopicState;
  if (n === 1) state = estimate < WEAK_BELOW ? "developing" : "early";
  else if (estimate < WEAK_BELOW) state = "needs";
  else if (estimate < DEVELOPING_BELOW) state = "developing";
  else state = now - lastAt >= RUSTY_AFTER_DAYS * DAY ? "rusty" : "strong";
  return { state, tried: state === "early", estimate, attempts: n, scored, outOf, lastAt };
}

/** Every attempt on a topic: the parts tagged with it, or with one of its topics when it is a section. */
export function topicAttempts(bank: Record<string, PartRecord> | undefined, codes: string[]): Attempt[] {
  if (!bank) return [];
  const want = new Set(codes);
  const out: Attempt[] = [];
  for (const rec of Object.values(bank)) if (rec.t.some(t => want.has(t))) out.push(...rec.h);
  return out;
}

/** A local calendar day, "2026-10-27", so a streak turns over at the student's midnight. */
export const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Midday, `back` calendar days before `now`: stepping in 24 hours would land on one day twice when the clocks change. */
const daysBack = (now: number, back: number) => { const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - back); return d.getTime(); };

/** Parts marked on each of the last `days` days, oldest first: in one subject, or every subject. */
export function dailyCounts(store: Store, days: number, subject?: string, now = Date.now()) {
  const counts = new Map<string, number>();
  const banks = subject ? [store.subjects[subject] ?? {}] : Object.values(store.subjects);
  for (const bank of banks) for (const rec of Object.values(bank)) for (const a of rec.h) {
    const k = dayKey(a[2]);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const at = daysBack(now, days - 1 - i);
    return { day: dayKey(at), at, n: counts.get(dayKey(at)) ?? 0 };
  });
}

/** Days in a row with at least one question marked, ending today, or yesterday if today is still to come. */
export function streak(store: Store, now = Date.now()) {
  const marked = new Set<string>();
  for (const bank of Object.values(store.subjects)) for (const rec of Object.values(bank)) for (const a of rec.h) marked.add(dayKey(a[2]));
  let back = marked.has(dayKey(now)) ? 0 : 1;
  let n = 0;
  while (marked.has(dayKey(daysBack(now, back)))) { n++; back++; }
  return n;
}

/* ── History: what you've done, and what should come back ────────────────── */

/**
 * Where a part stands for the list:
 *   new      never marked;
 *   done     marked, and the last try went well enough: it stays out of the way;
 *   waiting  the last try was a miss, and it's too soon to try again;
 *   again    a miss whose wait is over: "Have another go".
 * A miss is under the app's developing edge (62%); a rough "Partly" or "Missed" is one
 * too. The first miss comes back after 3 days; a second miss in a row after a week, and
 * every miss after that a week later, until the student gets it.
 */
export type PartStatus = "new" | "done" | "waiting" | "again";
const AGAIN_AFTER_DAYS = [3, 7];
const missed = (a: Attempt) => (a[1] ? a[0] / a[1] : 0) < DEVELOPING_BELOW;

export function partStatus(rec: PartRecord | undefined, now = Date.now()): { status: PartStatus; last?: Attempt; dueAt?: number } {
  const last = rec?.h[rec.h.length - 1];
  if (!last) return { status: "new" };
  if (!missed(last)) return { status: "done", last };
  let run = 0;
  for (let i = rec!.h.length - 1; i >= 0 && missed(rec!.h[i]); i--) run++;
  const dueAt = last[2] + AGAIN_AFTER_DAYS[Math.min(run, AGAIN_AFTER_DAYS.length) - 1] * DAY;
  return { status: now >= dueAt ? "again" : "waiting", last, dueAt };
}

/**
 * "Hide what I've done": on unless the student turns it off, and remembered in this
 * browser. Hidden are the parts that are done or waiting; "again" ones always show.
 */
const HIDE_KEY = "plumi-bank-hide-done";
const hideListeners = new Set<() => void>();
function readHide() {
  try { return localStorage.getItem(HIDE_KEY) !== "0"; } catch { return hideMemory; }
}
let hideMemory = true;
export function setHideDone(on: boolean) {
  hideMemory = on;
  try { localStorage.setItem(HIDE_KEY, on ? "1" : "0"); } catch { /* memory only */ }
  hideListeners.forEach(l => l());
  track("bank_hide_done", { on: on ? 1 : 0 });
}
export const useHideDone = () => useSyncExternalStore(cb => { hideListeners.add(cb); return () => { hideListeners.delete(cb); }; }, readHide, () => true);
