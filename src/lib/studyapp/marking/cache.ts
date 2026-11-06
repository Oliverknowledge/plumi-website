import type { MarkReply } from "./api";

/**
 * A mark already given for exactly this answer is shown again, never bought again: the same part, the same version of the pictures and the
 * same words (spacing ignored) is the same question to the marker. The result lives on this device only (CLAUDE.md: nothing about a
 * student's answer is kept on the server), under its own key, bounded so it never grows without end, and it is only ever a convenience:
 * storage that is missing, full or unreadable just means the answer is marked again.
 */
export const CACHE_KEY = "plumi.aimarks.v1";
export const CACHE_MAX = 150;

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }

/** FNV-1a over the normalised answer: a short key, not a secret. */
export function answerKey(bank: string, partId: string, cropVersion: number, answer: string): string {
  const text = answer.trim().replace(/\s+/g, " ");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${bank}|${partId}|${cropVersion}|${text.length}.${h.toString(36)}`;
}

function load(kv: KV): [string, MarkReply][] {
  try {
    const raw = kv.getItem(CACHE_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((e): e is [string, MarkReply] => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "object" && e[1] !== null) : [];
  } catch { return []; }
}

export function getCached(kv: KV | null, key: string): MarkReply | null {
  if (!kv) return null;
  return load(kv).find(([k]) => k === key)?.[1] ?? null;
}

export function putCached(kv: KV | null, key: string, reply: MarkReply): void {
  if (!kv) return;
  const rest = load(kv).filter(([k]) => k !== key);
  rest.push([key, reply]);
  try { kv.setItem(CACHE_KEY, JSON.stringify(rest.slice(-CACHE_MAX))); } catch { /* full or blocked: the mark is simply not kept */ }
}
