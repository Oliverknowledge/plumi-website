"use client";

import { useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";

/**
 * Typed answers in the question bank (founder, 30 October 2026: "the ability to type
 * answers… then they can pull up the mark scheme and self mark"). A draft per part, kept
 * in this browser as the student types, so an essay started tonight is there tomorrow.
 * Nothing marks it: the student reads the scheme beside it and marks themselves.
 *
 * Storage can be missing (private windows), so every access is guarded and drafts then
 * live for the visit only.
 */

const KEY = "plumi-bank-answers:v1";
/** The longest draft kept: a long essay is about 1,500 words; this leaves room. */
const MAX = 20_000;

type Drafts = Record<string, { text: string; at: number }>;
const EMPTY: Drafts = {};

let memory: string | null = null;
const listeners = new Set<() => void>();
function readRaw() {
  try { return localStorage.getItem(KEY) ?? memory ?? ""; } catch { return memory ?? ""; }
}
function writeRaw(value: string) {
  memory = value;
  try { localStorage.setItem(KEY, value); } catch { /* storage unavailable or full: memory only */ }
  listeners.forEach(l => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}
let parsed: { raw: string; drafts: Drafts } = { raw: "", drafts: EMPTY };
function parse(raw: string): Drafts {
  if (raw === parsed.raw) return parsed.drafts;
  let drafts = EMPTY;
  try { const v = JSON.parse(raw); if (v && typeof v === "object") drafts = v; } catch { /* unreadable: start again */ }
  parsed = { raw, drafts };
  return drafts;
}

/** The saved draft for a part, read live (another tab's typing shows here too). */
export function useAnswer(part: string) {
  return parse(useSyncExternalStore(subscribe, readRaw, () => ""))[part]?.text ?? "";
}

const started = new Set<string>();
/** Save a part's draft; an empty one is removed. */
export function saveAnswer(subject: string, part: string, text: string) {
  const drafts = { ...parse(readRaw()) };
  const clean = text.slice(0, MAX);
  if (clean.trim()) drafts[part] = { text: clean, at: Date.now() };
  else delete drafts[part];
  writeRaw(JSON.stringify(drafts));
  if (clean.trim() && !started.has(part)) {
    started.add(part);
    track("bank_answer_started", { subject, part });
  }
}

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
