"use client";

import { onUser, supabase } from "@/lib/account";
import { allAttempts, mergeAttempts, onMarkEvent, type Attempt, type MarkEvent } from "@/lib/bankProgress";

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
 * waits for "Your subjects"),
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

/** Start once per page; safe to call from every component that wants it. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  onUser(id => { user = id; if (id) void fullSync(id); });
  onMarkEvent(e => { void pushMark(e); });
}
