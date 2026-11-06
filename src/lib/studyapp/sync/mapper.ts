import type { Card, Deck, Task } from "../model";
import { START_EASE, type CardState, type Schedule } from "../srs";
import { GENERATED_TITLE_PREFIXES, SCHEDULE, SYNC_LIMITS } from "./contract";

/**
 * The website's decks, cards and tasks to and from the wire shapes of CONTRACT.json, in both directions. Pure: no clock, no storage.
 *
 * What is NOT backed up, and why:
 *  - a deck Plumi made (its `starter` is set: the premade catalogue, the starters, "My mistakes") or whose name starts with a generated
 *    prefix ("Mark scheme ·", "Key wording ·", "Mistakes:"): it is remade on every device from Plumi's own content;
 *  - a card with `pic`: its sides are pictures from the question bank, which belong to the bank and the boards, and the wire carries
 *    only a picture's file name, not a bank crop descriptor. Backing up its label and marks without its pictures would restore a card
 *    that makes no sense.
 */

/* ── Hashing, for "did this change since the server last confirmed it" ──────────────────────────────────────── */

/** JSON with object keys in sorted order, so equal data is equal text whatever order it was built in. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

/** cyrb53: a fast 53-bit string hash. It only has to tell "changed" from "same" for one row, not resist an attacker. */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export const hashOf = (v: unknown): string => hashText(stableStringify(v));

/* ── What is synced ──────────────────────────────────────────────────────────────────────────────────────────── */

export const isGeneratedTitle = (title: string): boolean => GENERATED_TITLE_PREFIXES.some((p) => title.startsWith(p));
/** A deck Plumi made, which is remade on each device and not backed up as the student's own. */
export const isGeneratedDeck = (d: Pick<Deck, "title" | "starter">): boolean => d.starter != null || isGeneratedTitle(d.title);
export const hasPic = (c: Pick<Card, "pic">): boolean => c.pic !== undefined;
export const validId = (id: string): boolean => id.length >= SYNC_LIMITS.idMin && id.length <= SYNC_LIMITS.idMax && SYNC_LIMITS.idPattern.test(id);

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);
const clipOrNull = (s: string | null, n: number): string | null => (s === null ? null : clip(s, n));

/* ── Wire shapes ─────────────────────────────────────────────────────────────────────────────────────────────── */

export interface WireCore { due_ms: number; interval_days: number; ease: number; lapses: number; last_reviewed_ms: number | null }
export interface WebExtra { state: CardState; reps: number; step: number; relearn_to: number | null }
export interface WireExtra { web?: WebExtra; ios?: Record<string, unknown>; [platform: string]: unknown }
export interface WireSched { core: WireCore; extra: WireExtra }
export interface WireCardContent { position: number; front: string; back: string; front_image: string | null; back_image: string | null }
export interface WireCard { id: string; deck_id: string; created_at_ms: number; content: WireCardContent; sched: WireSched }
export interface WireTask {
  id: string; text: string; subject: string | null; day: string | null; repeat_days: number; has_ink: boolean;
  done_at_ms: number | null; filed_at_ms: number | null; created_at_ms: number; sort_order: number;
}

/** What the website keeps beside a card about the parts it does not show: the iPad's schedule extras, a picture's file name, the position. */
export interface CardKeep { position?: number; frontImage?: string | null; backImage?: string | null; extra?: Record<string, unknown> }
export interface TaskKeep { filedAt?: number | null; sortOrder?: number }

/* ── Schedules ───────────────────────────────────────────────────────────────────────────────────────────────── */

const clampEase = (e: number): number => Math.min(SCHEDULE.easeMax, Math.max(SCHEDULE.easeMin, e));
const finite = (n: unknown, fallback: number): number => (typeof n === "number" && Number.isFinite(n) ? n : fallback);

/** The wire schedule for a web card: the common core, the web's own extra, and every other platform's extra exactly as it was. */
export function scheduleToWire(sch: Schedule, lastReviewed: number | null, otherExtras: Record<string, unknown> = {}): WireSched {
  const { web: _drop, ...others } = otherExtras; void _drop;
  return {
    core: { due_ms: Math.round(sch.due), interval_days: sch.interval, ease: clampEase(sch.ease), lapses: sch.lapses, last_reviewed_ms: lastReviewed === null ? null : Math.round(lastReviewed) },
    extra: { ...others, web: { state: sch.state, reps: sch.reps, step: sch.step, relearn_to: sch.relearnTo } },
  };
}

const isWebExtra = (x: unknown): x is WebExtra => {
  if (!x || typeof x !== "object") return false;
  const w = x as Record<string, unknown>;
  return (w.state === "new" || w.state === "learning" || w.state === "review")
    && typeof w.reps === "number" && Number.isInteger(w.reps) && w.reps >= 0
    && (w.step === 0 || w.step === 1)
    && (w.relearn_to === null || (typeof w.relearn_to === "number" && Number.isFinite(w.relearn_to)));
};

/**
 * A web schedule from the wire. The web's own extra is trusted only when it still fits the core: another device may have rewritten the core
 * (an iPad review) and left the web's extra as it was, so a "learning" extra over an interval of days, or a "review" over none, is stale and
 * the schedule is rebuilt from the core instead. With no web extra at all (the card came from an iPad) it is always rebuilt:
 *   never reviewed -> new; an interval of a day or more -> review; reviewed but under a day -> learning.
 */
export function scheduleFromWire(sched: WireSched, lastReviewed: number | null): Schedule {
  const c = sched.core;
  const base = { due: c.due_ms, interval: c.interval_days, ease: clampEase(finite(c.ease, START_EASE)), lapses: c.lapses };
  const w = sched.extra?.web;
  if (isWebExtra(w)) {
    const fits = w.state === "review" ? c.interval_days > 0 : w.state === "learning" ? c.interval_days === 0 : c.interval_days === 0 && c.lapses === 0 && lastReviewed === null;
    if (fits) return { state: w.state, ...base, reps: w.reps, step: w.step, relearnTo: w.relearn_to };
  }
  if (lastReviewed === null && c.lapses === 0 && c.interval_days === 0) return { state: "new", ...base, reps: 0, step: 0, relearnTo: null };
  if (c.interval_days >= 1) return { state: "review", ...base, reps: 1, step: 0, relearnTo: null };
  return { state: "learning", ...base, reps: 0, step: 0, relearnTo: null };
}

/* ── Decks ───────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface WireDeck { id: string; title: string; subject: string | null; origin: "own"; created_at_ms: number }
export const deckToWire = (d: Deck): WireDeck => ({
  id: d.id, title: clip(d.title, SYNC_LIMITS.deckTitle), subject: clipOrNull(d.subject, SYNC_LIMITS.deckSubject), origin: "own", created_at_ms: d.createdAt,
});

/* ── Cards ───────────────────────────────────────────────────────────────────────────────────────────────────── */

export function cardToWire(c: Card, position: number, keep: CardKeep = {}): WireCard {
  return {
    id: c.id, deck_id: c.deckId, created_at_ms: c.createdAt,
    content: {
      position, front: clip(c.front, SYNC_LIMITS.cardSide), back: clip(c.back, SYNC_LIMITS.cardSide),
      front_image: clipOrNull(keep.frontImage ?? null, SYNC_LIMITS.pictureName), back_image: clipOrNull(keep.backImage ?? null, SYNC_LIMITS.pictureName),
    },
    sched: scheduleToWire(c.sch, c.lastReviewed, keep.extra),
  };
}

/** A server card row as the website reads it (validated: anything else is null and ignored). */
export interface ServerCard {
  id: string; deckId: string; createdAt: number; contentAt: number; schedAt: number;
  position: number; front: string; back: string; frontImage: string | null; backImage: string | null;
  sched: WireSched; rev: number; contentRev: number; schedRev: number; deletedAt: number | null; conflictOf: string | null;
}
export interface ServerDeck { id: string; title: string; subject: string | null; createdAt: number; rev: number; contentRev: number; deletedAt: number | null }
export interface ServerTask {
  id: string; text: string; subject: string | null; day: string | null; repeatDays: number; hasInk: boolean;
  doneAt: number | null; filedAt: number | null; createdAt: number; sortOrder: number; rev: number; deletedAt: number | null;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const str = (x: unknown): string | null => (typeof x === "string" ? x : null);
const int = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? Math.trunc(x) : typeof x === "string" && /^-?\d+$/.test(x) ? Number(x) : null);
const optStr = (x: unknown): string | null | undefined => (x === null || x === undefined ? null : typeof x === "string" ? x : undefined);

export function parseServerDeck(raw: unknown): ServerDeck | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id), title = str(raw.title), created = int(raw.created_at_ms), rev = int(raw.rev);
  const subject = optStr(raw.subject);
  if (!id || !validId(id) || title === null || created === null || rev === null || subject === undefined) return null;
  const deleted = raw.deleted_at_ms === null || raw.deleted_at_ms === undefined ? null : int(raw.deleted_at_ms);
  return { id, title, subject, createdAt: created, rev, contentRev: int(raw.content_rev) ?? rev, deletedAt: deleted };
}

export function parseServerCard(raw: unknown): ServerCard | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id), deckId = str(raw.deck_id), created = int(raw.created_at_ms), rev = int(raw.rev);
  if (!id || !validId(id) || !deckId || !validId(deckId) || created === null || rev === null) return null;
  const deleted = raw.deleted_at_ms === null || raw.deleted_at_ms === undefined ? null : int(raw.deleted_at_ms);
  const content = isObj(raw.content) ? raw.content : null;
  const sched = isObj(raw.sched) ? raw.sched : null;
  const core = sched && isObj(sched.core) ? sched.core : null;
  // A tombstone may arrive without its words; a live row may not.
  const front = content ? str(content.front) : null, back = content ? str(content.back) : null;
  const due = core ? int(core.due_ms) : null;
  if (deleted === null && (!content || front === null || back === null || !core || due === null)) return null;
  const fi = content ? optStr(content.front_image) : null, bi = content ? optStr(content.back_image) : null;
  if (fi === undefined || bi === undefined) return null;
  const last = core && core.last_reviewed_ms !== null && core.last_reviewed_ms !== undefined ? int(core.last_reviewed_ms) : null;
  return {
    id, deckId, createdAt: created, contentAt: int(raw.content_at_ms) ?? 0, schedAt: int(raw.sched_at_ms) ?? 0,
    position: (content ? int(content.position) : null) ?? 0, front: front ?? "", back: back ?? "", frontImage: fi, backImage: bi,
    sched: {
      core: { due_ms: due ?? 0, interval_days: finite(core?.interval_days, 0), ease: finite(core?.ease, START_EASE), lapses: int(core?.lapses) ?? 0, last_reviewed_ms: last },
      extra: sched && isObj(sched.extra) ? (sched.extra as WireExtra) : {},
    },
    rev, contentRev: int(raw.content_rev) ?? rev, schedRev: int(raw.sched_rev) ?? rev, deletedAt: deleted,
    conflictOf: typeof raw.conflict_of === "string" ? raw.conflict_of : null,
  };
}

export function parseServerTask(raw: unknown): ServerTask | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id), text = str(raw.text), created = int(raw.created_at_ms), rev = int(raw.rev);
  const subject = optStr(raw.subject), day = optStr(raw.day);
  if (!id || !validId(id) || text === null || created === null || rev === null || subject === undefined || day === undefined) return null;
  const deleted = raw.deleted_at_ms === null || raw.deleted_at_ms === undefined ? null : int(raw.deleted_at_ms);
  return {
    id, text, subject, day, repeatDays: int(raw.repeat_days) ?? 0, hasInk: raw.has_ink === true,
    doneAt: raw.done_at_ms === null || raw.done_at_ms === undefined ? null : int(raw.done_at_ms), filedAt: raw.filed_at_ms === null || raw.filed_at_ms === undefined ? null : int(raw.filed_at_ms),
    createdAt: created, sortOrder: int(raw.sort_order) ?? 0, rev, deletedAt: deleted,
  };
}

/** A web card from a server row, and what to keep beside it. Conflict copies come through here as ordinary cards. */
export function cardFromWire(row: ServerCard): { card: Card; keep: CardKeep } {
  const { web: _drop, ...others } = (row.sched.extra ?? {}) as Record<string, unknown>; void _drop;
  return {
    card: { id: row.id, deckId: row.deckId, front: row.front, back: row.back, createdAt: row.createdAt, sch: scheduleFromWire(row.sched, row.sched.core.last_reviewed_ms), lastReviewed: row.sched.core.last_reviewed_ms },
    keep: { position: row.position, frontImage: row.frontImage, backImage: row.backImage, extra: others },
  };
}

export function deckFromWire(row: ServerDeck): Deck {
  return { id: row.id, title: row.title, subject: row.subject, createdAt: row.createdAt, starter: null };
}

/* ── Tasks ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/** A web task never repeats and has no handwriting: `repeat_days` 0, `has_ink` false. */
export function taskToWire(t: Task, keep: TaskKeep = {}): WireTask {
  const doneAt = t.done ? (t.doneAt ?? t.createdAt) : null;
  return {
    id: t.id, text: clip(t.text, SYNC_LIMITS.taskText), subject: clipOrNull(t.subject, SYNC_LIMITS.taskSubject), day: t.due, repeat_days: 0, has_ink: false,
    done_at_ms: doneAt, filed_at_ms: keep.filedAt ?? null, created_at_ms: t.createdAt, sort_order: keep.sortOrder ?? 0,
  };
}

/** Why a server task is not shown as an ordinary web task (it is kept as it is and written back untouched), or null if it can be. */
export function taskHeldReason(row: Pick<ServerTask, "repeatDays" | "hasInk" | "day">): "repeating" | "ink" | "undated" | null {
  if (row.repeatDays !== 0) return "repeating";
  if (row.hasInk) return "ink";
  if (row.day === null || !/^\d{4}-\d{2}-\d{2}$/.test(row.day)) return "undated";
  return null;
}

export function taskFromWire(row: ServerTask): { task: Task; keep: TaskKeep } | null {
  if (taskHeldReason(row) !== null) return null;
  return {
    task: { id: row.id, text: row.text, subject: row.subject, due: row.day as string, done: row.doneAt !== null, createdAt: row.createdAt, doneAt: row.doneAt },
    keep: { filedAt: row.filedAt, sortOrder: row.sortOrder },
  };
}

/* ── The local fingerprints (what the web holds, not what the wire carries) ─────────────────────────────────── */

export const deckHash = (d: Deck): string => hashOf([d.title, d.subject]);
export const cardContentHash = (c: Card, keep: CardKeep | undefined): string => hashOf([c.deckId, c.front, c.back, keep?.frontImage ?? null, keep?.backImage ?? null]);
export const cardSchedHash = (c: Card): string => hashOf([c.sch.state, c.sch.due, c.sch.interval, c.sch.ease, c.sch.reps, c.sch.lapses, c.sch.step, c.sch.relearnTo, c.lastReviewed]);
export const taskHash = (t: Task): string => hashOf([t.text, t.subject, t.due, t.done ? (t.doneAt ?? t.createdAt) : null]);
