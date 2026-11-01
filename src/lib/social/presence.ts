import type { StudyMode, StudyPresence } from "./types";

/**
 * Whether a friend is studying now, read from their presence row and the clock (the app's
 * PresenceReading.swift). Deterministic and on this side of the wire, because the row alone is not the
 * answer: a tab closed mid-session leaves its row behind until `expires_at`, a Pomodoro phase that
 * ended without a phase change is over, and a clock a minute fast must not show a timer counting down
 * from the future.
 */
export const END_GRACE_MS = 90_000;
export const FUTURE_TOLERANCE_MS = 5 * 60_000;

export type PresenceReading =
  | { state: "idle" }
  | { state: "studying" | "onBreak"; subjectId: string; mode: StudyMode; since: number; until: number | null };

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

export function readPresence(p: StudyPresence | null | undefined, now: number): PresenceReading {
  if (!p) return { state: "idle" };
  const expires = time(p.expiresAt);
  if (Number.isFinite(expires) && now >= expires) return { state: "idle" };
  const started = time(p.startedAt);
  const end = time(p.endsAt);
  if (Number.isFinite(end) && now >= end + END_GRACE_MS) return { state: "idle" };
  if (Number.isFinite(started) && started > now + FUTURE_TOLERANCE_MS) return { state: "idle" };
  // A start slightly ahead of this clock counts from now, never from the future.
  const since = Number.isFinite(started) ? Math.min(started, now) : now;
  return {
    state: p.phase === "work" ? "studying" : "onBreak",
    subjectId: p.subjectId,
    mode: p.mode,
    since,
    until: Number.isFinite(end) ? end : null,
  };
}

export const isStudyingNow = (p: StudyPresence | null | undefined, now: number) => readPresence(p, now).state === "studying";

/** Seconds into the session, never negative. */
export function elapsedSeconds(r: PresenceReading, now: number): number {
  return r.state === "idle" ? 0 : Math.max(0, Math.floor((now - r.since) / 1000));
}
