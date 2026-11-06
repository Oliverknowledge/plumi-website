"use client";

import { onUser, supabase } from "@/lib/account";
import { allAttempts, mergeAttempts, onMarkEvent, type Attempt, type MarkEvent } from "@/lib/bankProgress";
import { clearSaved, mergeSaved, onSavedChange, savedItems, savedOwner, setSavedOwner, toSend } from "@/lib/bankSaved";

/**
 * Keeps a signed-in student's marks in their account, so they follow them to any
 * browser (and, once the app reads them, to the iPad).
 *
 * The browser stays the place every view reads from: this only copies. On signing in,
 * the account's attempts come down and are merged in, then whatever this browser has
 * that the account doesn't goes up (marking before signing in is never lost). After
 * that each mark, correction and undo goes up as it happens.
 *
 * Tables: bank_attempt and bank_prefs (supabase/migrations/0004_bank_progress.sql; bank_prefs
 * waits for "Your subjects"), and bank_saved (0005, further down),
 * each row-level secured to its owner. If they aren't there yet, sync stays quiet and
 * the site carries on saving to this browser.
 */

type Row = { user_id: string; part_id: string; subject: string; topics: string[]; score: number; out_of: number; pick: string | null; at: string };

const toRow = (user: string, subject: string, part: string, topics: string[], a: Attempt): Row =>
  ({ user_id: user, part_id: part, subject, topics, score: a[0], out_of: a[1], pick: a[3] ?? null, at: new Date(a[2]).toISOString() });

let user: string | null = null;
let started = false;
let warned = false;
function quiet(error: { message: string } | null) {
  if (error && !warned) { warned = true; console.warn("Plumi: marks aren’t syncing to your account yet:", error.message); }
  return !error;
}

async function pullAll(uid: string) {
  const sb = supabase()!;
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("bank_attempt").select("user_id,part_id,subject,topics,score,out_of,pick,at").eq("user_id", uid).order("at").range(from, from + 999);
    if (!quiet(error) || !data) return null;
    rows.push(...(data as Row[]));
    if (data.length < 1000) return rows;
  }
}

async function fullSync(uid: string) {
  const sb = supabase();
  if (!sb) return;
  const remote = await pullAll(uid);
  if (!remote || user !== uid) return;
  mergeAttempts(remote.map(r => ({ subject: r.subject, part: r.part_id, topics: r.topics, attempt: (r.pick ? [r.score, r.out_of, Date.parse(r.at), r.pick] : [r.score, r.out_of, Date.parse(r.at)]) as Attempt })));
  const have = new Set(remote.map(r => `${r.part_id}|${Date.parse(r.at)}`));
  const missing = allAttempts().filter(x => !have.has(`${x.part}|${x.attempt[2]}`)).map(x => toRow(uid, x.subject, x.part, x.topics, x.attempt));
  for (let i = 0; i < missing.length; i += 500) {
    const { error } = await sb.from("bank_attempt").upsert(missing.slice(i, i + 500), { onConflict: "user_id,part_id,at", ignoreDuplicates: true });
    if (!quiet(error)) return;
  }
}

async function pushMark(e: MarkEvent) {
  const sb = supabase();
  if (!sb || !user) return;
  if (e.kind === "set") {
    // A correction keeps its attempt's time, so it replaces that row rather than adding one.
    quiet((await sb.from("bank_attempt").upsert(toRow(user, e.subject, e.part, e.topics, e.attempt), { onConflict: "user_id,part_id,at" })).error);
  } else {
    quiet((await sb.from("bank_attempt").delete().eq("user_id", user).eq("part_id", e.part).eq("at", new Date(e.at).toISOString())).error);
  }
}

/* ── Saved questions: bookmarks and notes (lib/bankSaved; supabase/migrations/0005_bank_saved.sql) ── */

type SavedRow = { user_id: string; part_id: string; subject: string; bookmarked: boolean; note: string; updated_at: string };

const toSavedRow = (uid: string, part: string): SavedRow | null => {
  const e = savedItems()[part];
  return e ? { user_id: uid, part_id: part, subject: e.s, bookmarked: e.b, note: e.n, updated_at: new Date(e.at).toISOString() } : null;
};

let warnedSaved = false;
function quietSaved(error: { message: string } | null) {
  if (error && !warnedSaved) { warnedSaved = true; console.warn("Plumi: saved questions aren’t syncing to your account yet:", error.message); }
  return !error;
}

async function pushSaved(uid: string, parts: string[]) {
  const sb = supabase();
  if (!sb) return false;
  const rows = parts.map(p => toSavedRow(uid, p)).filter((r): r is SavedRow => !!r);
  for (let i = 0; i < rows.length; i += 500) {
    if (!quietSaved((await sb.from("bank_saved").upsert(rows.slice(i, i + 500), { onConflict: "user_id,part_id" })).error)) return false;
  }
  return true;
}

async function fullSyncSaved(uid: string) {
  const sb = supabase();
  if (!sb) return;
  const remote: SavedRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("bank_saved").select("user_id,part_id,subject,bookmarked,note,updated_at").eq("user_id", uid).order("part_id").range(from, from + 999);
    if (!quietSaved(error) || !data || user !== uid) return;
    remote.push(...(data as SavedRow[]));
    if (data.length < 1000) break;
  }
  mergeSaved(remote.map(r => ({ part: r.part_id, entry: { s: r.subject, b: r.bookmarked, n: r.note, at: Date.parse(r.updated_at) } })));
  const missing = toSend(savedItems(), remote.map(r => ({ part: r.part_id, at: Date.parse(r.updated_at) })));
  if (await pushSaved(uid, missing) && user === uid) setSavedOwner(uid);
}

/**
 * A change waits a moment, so a note being typed, or a whole question's parts, go up as one
 * request. One that doesn't arrive (offline, the tab closed) is still newer here than in the
 * account, so the next full sync sends it.
 */
const waiting = new Set<string>();
let savedTimer: ReturnType<typeof setTimeout> | null = null;
function flushSaved() {
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null; }
  if (user && waiting.size) void pushSaved(user, [...waiting]);
  waiting.clear();
}

/**
 * Notes are a student's own words, and computers get shared. So when a browser's copy has
 * been synced with an account, it leaves with that account: at sign-out (it's all still in the
 * account), and before anyone else's sign-in, so one student's notes never go up into another's.
 */
function savedForUser(id: string | null) {
  const owner = savedOwner();
  if (owner && owner !== id) { waiting.clear(); clearSaved(); }
  if (id) void fullSyncSaved(id);
}

/** Start once per page; safe to call from every component that wants it. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  onUser(id => { user = id; if (id) void fullSync(id); savedForUser(id); });
  onMarkEvent(e => { void pushMark(e); });
  onSavedChange(parts => {
    if (!user) return;
    parts.forEach(p => waiting.add(p));
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(flushSaved, 1500);
  });
  window.addEventListener("pagehide", flushSaved);
}
