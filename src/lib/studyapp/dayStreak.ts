"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { accountsOn, useAccount } from "@/lib/account";
import { social } from "@/lib/social/browser";
import { useNow } from "./clock";
import { useQuestions } from "./questions/store";
import { mergeDays, questionDays, questionsToday, streakNow } from "./streak";
import { dayOf } from "./time";

/**
 * The day streak and the questions done today, for the Desk and the Questions page (the rules are streak.ts's). The London days on which the student did real
 * work are kept on this device (`plumi-study-days`, newest 400), so a streak does not shrink when an old answer is changed; the server's own figure (the iPad's) is
 * read once a few minutes, best-effort, and only ever raises the number.
 */
const KEY = "plumi-study-days";
let kept: string[] = [];
let started = false;
const listeners = new Set<() => void>();
const NONE: string[] = [];

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as { days?: unknown } | null;
    kept = raw && Array.isArray(raw.days) ? raw.days.filter((d): d is string => typeof d === "string") : [];
  } catch { /* nothing kept */ }
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try { const j = JSON.parse(e.newValue ?? "null") as { days?: unknown } | null; kept = j && Array.isArray(j.days) ? j.days.filter((d): d is string => typeof d === "string") : kept; } catch { return; }
    listeners.forEach((l) => l());
  });
}
const subscribe = (cb: () => void) => { start(); listeners.add(cb); return () => { listeners.delete(cb); }; };

/** Add the days now found to those kept (a private window or a full disk just means they last for the visit). */
function record(found: string[], today: string) {
  start();
  const next = mergeDays(kept, found, today);
  if (next.length === kept.length && next.every((d, i) => d === kept[i])) return;
  kept = next;
  try { window.localStorage.setItem(KEY, JSON.stringify({ v: 1, days: kept })); } catch { /* kept for the visit */ }
  listeners.forEach((l) => l());
}

interface ServerRow { streak: number; streakDay: string | null }
const SERVER_MS = 5 * 60_000;
const seen = new Map<string, { at: number; row: ServerRow | null }>();

/** The student's own streak as the server has it (the iPad publishes it); null when signed out, offline, or nothing published. */
function useServerRow(): ServerRow | null {
  const { user } = useAccount();
  const uid = user?.id ?? null;
  const [got, setGot] = useState<{ uid: string; row: ServerRow | null } | null>(null);
  useEffect(() => {
    if (!accountsOn || !uid) return;
    const hit = seen.get(uid);
    if (hit && Date.now() - hit.at < SERVER_MS) return;
    let live = true;
    void social.mySummary().then((r) => {
      if (!r.ok) return;
      const row = r.value ? { streak: r.value.streak, streakDay: r.value.streakDay } : null;
      seen.set(uid, { at: Date.now(), row });
      if (live) setGot({ uid, row });
    });
    return () => { live = false; };
  }, [uid]);
  return got && got.uid === uid ? got.row : uid ? seen.get(uid)?.row ?? null : null;
}

export interface DayFigures {
  /** Null until the day and the questions are known (nothing is shown before that). */
  streak: number | null;
  /** Questions marked or answered today. */
  questions: number;
}

export function useDayFigures(): DayFigures {
  const { ready, q } = useQuestions();
  const now = useNow(30_000);
  const today = ready && now ? dayOf(now) : null;
  const keptDays = useSyncExternalStore(subscribe, () => { start(); return kept; }, () => NONE);
  const found = useMemo(() => (ready ? questionDays(q) : NONE), [ready, q]);
  useEffect(() => { if (today && found.length > 0) record(found, today); }, [found, today]);
  const server = useServerRow();
  return useMemo(() => {
    if (!today) return { streak: null, questions: 0 };
    return { streak: streakNow(mergeDays(keptDays, found, today), server, today), questions: questionsToday(q, today) };
  }, [today, keptDays, found, server, q]);
}
