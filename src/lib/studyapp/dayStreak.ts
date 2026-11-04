"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { accountsOn, useAccount } from "@/lib/account";
import { social } from "@/lib/social/browser";
import { useNow } from "./clock";
import { useQuestions } from "./questions/store";
import { dayKeep } from "./dayKeep";
import { mergeDays, questionDays, questionsToday, streakNow } from "./streak";
import { dayOf } from "./time";

/**
 * The day streak and the questions done today, for the Desk and the Questions page (the rules are streak.ts's). The London days on which the student did real
 * work are kept on this device (`plumi-study-days`, newest 400; dayKeep.ts), written by the questions store whenever an answer is written, marked or inked, on any page, so a streak
 * does not shrink when an old answer is changed; the server's own figure (the iPad's) is read once a few minutes, best-effort, and only ever raises the number.
 */
const NONE: string[] = [];
const subscribe = (cb: () => void) => dayKeep().subscribe(cb);

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
  const keptDays = useSyncExternalStore(subscribe, () => dayKeep().snapshot(), () => NONE);
  const found = useMemo(() => (ready ? questionDays(q) : NONE), [ready, q]);
  const server = useServerRow();
  return useMemo(() => {
    if (!today) return { streak: null, questions: 0 };
    return { streak: streakNow(mergeDays(keptDays, found, today), server, today), questions: questionsToday(q, today) };
  }, [today, keptDays, found, server, q]);
}
