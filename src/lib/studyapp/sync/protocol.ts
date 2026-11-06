import { KIND_KEYS, REFUSAL_REASONS, type RefusalReason } from "./contract";
import { parseServerCard, parseServerDeck, parseServerTask, type ServerCard, type ServerDeck, type ServerTask, type WireCardContent, type WireCore, type WireExtra, type WireDeck, type WireTask } from "./mapper";

/** `p_changes`: what one push sends. Every kind's key is always present (an empty list is "nothing of this kind"). */
export interface DeckChange extends Partial<WireDeck> { id: string; edited_at_ms: number; base_content_rev: number; deleted_at_ms?: number }
export interface CardChange {
  id: string; deck_id: string; created_at_ms: number; base_rev: number;
  content?: WireCardContent; content_at_ms?: number; base_content_rev?: number;
  sched?: { core: WireCore; extra: WireExtra }; sched_at_ms?: number; base_sched_rev?: number;
  deleted_at_ms?: number;
}
export interface TaskChange extends Partial<WireTask> { id: string; edited_at_ms: number; created_at_ms: number; base_rev: number; deleted_at_ms?: number }
export interface Changes { decks: DeckChange[]; cards: CardChange[]; tasks: TaskChange[]; task_done: never[]; flags: never[] }

export type SyncKind = "deck" | "card" | "task";
export interface Conflict { kind: SyncKind; id: string; copyId: string }
export interface Refusal { kind: SyncKind; id: string; reason: RefusalReason }

/** The rows of an answer, validated. Rows that are not well-formed are dropped (never guessed at). task_done and flags are not used by the website. */
export interface Rows { decks: ServerDeck[]; cards: ServerCard[]; tasks: ServerTask[] }
export interface PushResponse { rev: number; applied: number; conflicts: Conflict[]; refused: Refusal[]; rows: Rows }
export interface PullPage extends Rows { rev: number; next: number; more: boolean }

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : typeof x === "string" && /^-?\d+$/.test(x) ? Number(x) : null);
const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

/** What PostgREST hands back for a function returning json: the value, or JSON text, or a one-element list. */
export function unwrap(data: unknown): unknown {
  let v = data;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return v; } }
  if (Array.isArray(v) && v.length === 1) v = v[0];
  if (isObj(v) && Object.keys(v).length === 1) {
    const only = Object.values(v)[0];
    if (isObj(only) && ("rev" in only)) v = only;   // keyed by the function's name
  }
  return v;
}

const kindOf = (x: unknown): SyncKind | null => {
  const s = typeof x === "string" ? x : "";
  if (s === "deck" || s === KIND_KEYS.deck) return "deck";
  if (s === "card" || s === KIND_KEYS.card) return "card";
  if (s === "task" || s === KIND_KEYS.task) return "task";
  return null;
};

function parseRows(x: unknown): Rows {
  const out: Rows = { decks: [], cards: [], tasks: [] };
  if (Array.isArray(x)) {
    // a flat list, each row naming its kind
    for (const r of x) {
      if (!isObj(r)) continue;
      const k = kindOf(r.kind);
      if (k === "deck") { const d = parseServerDeck(r); if (d) out.decks.push(d); }
      else if (k === "card") { const c = parseServerCard(r); if (c) out.cards.push(c); }
      else if (k === "task") { const t = parseServerTask(r); if (t) out.tasks.push(t); }
    }
    return out;
  }
  if (!isObj(x)) return out;
  for (const r of list(x[KIND_KEYS.deck])) { const d = parseServerDeck(r); if (d) out.decks.push(d); }
  for (const r of list(x[KIND_KEYS.card])) { const c = parseServerCard(r); if (c) out.cards.push(c); }
  for (const r of list(x[KIND_KEYS.task])) { const t = parseServerTask(r); if (t) out.tasks.push(t); }
  return out;
}

export function parsePullPage(data: unknown): PullPage | null {
  const v = unwrap(data);
  if (!isObj(v)) return null;
  const rev = num(v.rev), next = num(v.next);
  if (rev === null || next === null || typeof v.more !== "boolean") return null;
  return { rev, next, more: v.more, ...parseRows(v) };
}

export function parsePushResponse(data: unknown): PushResponse | null {
  const v = unwrap(data);
  if (!isObj(v)) return null;
  const rev = num(v.rev);
  if (rev === null) return null;
  const conflicts: Conflict[] = [];
  for (const c of list(v.conflicts)) {
    if (!isObj(c)) continue;
    const kind = kindOf(c.kind);
    if (kind && typeof c.id === "string" && typeof c.copy_id === "string") conflicts.push({ kind, id: c.id, copyId: c.copy_id });
  }
  const refused: Refusal[] = [];
  for (const r of list(v.refused)) {
    if (!isObj(r)) continue;
    const kind = kindOf(r.kind);
    const reason = (REFUSAL_REASONS as readonly string[]).includes(r.reason as string) ? (r.reason as RefusalReason) : "bad_row";
    if (kind && typeof r.id === "string") refused.push({ kind, id: r.id, reason });
  }
  return { rev, applied: num(v.applied) ?? 0, conflicts, refused, rows: parseRows(v.rows) };
}
