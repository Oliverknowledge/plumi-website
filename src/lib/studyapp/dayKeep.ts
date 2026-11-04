import { dayChanges, mergeDays, questionDays } from "./streak";
import { dayOf } from "./time";
import type { QuestionsData } from "./questions/model";

/**
 * The London days on which the student did real work, kept on this device (`plumi-study-days`, newest 400), so a streak never shrinks when an old answer is
 * changed. Days are only ever ADDED (the 400-day cap apart), and they are added where the work is written: the questions store tells this module of every
 * change to an answer (typing, ink, a mark) and of what it holds when it loads, whichever page is open. Before this, the days were recorded only while the Desk or the
 * feed was mounted, so work done in the paper sheet, then edited the next day (an answer's time moves with each edit), lost its first day.
 *
 * `makeDayKeep` takes the storage, so the rules are tested without a browser; `dayKeep` is the browser's one.
 */
export const DAYS_KEY = "plumi-study-days";

type Store = Pick<Storage, "getItem" | "setItem"> | null;

export function makeDayKeep(storage: () => Store) {
  let kept: string[] = [];
  const listeners = new Set<() => void>();
  const tell = () => listeners.forEach((l) => l());
  const parse = (raw: string | null): string[] | null => {
    try {
      const j = JSON.parse(raw ?? "null") as { days?: unknown } | null;
      return j && Array.isArray(j.days) ? j.days.filter((d): d is string => typeof d === "string") : null;
    } catch { return null; }
  };
  /** What storage holds now (another tab may have added days since this one last looked), else what this tab has. */
  const stored = (): string[] => {
    try { return parse(storage()?.getItem(DAYS_KEY) ?? null) ?? kept; } catch { return kept; }
  };
  let loaded = false;
  const load = () => { if (loaded) return; loaded = true; kept = stored(); };

  /** Add days (found now) to those kept: with the latest from storage first, so a tab that slept never writes back an older list. */
  function record(found: readonly string[], today: string) {
    if (found.length === 0) return;
    load();
    const next = mergeDays(stored(), [...kept, ...found], today);
    if (next.length === kept.length && next.every((d, i) => d === kept[i])) return;
    kept = next;
    try { storage()?.setItem(DAYS_KEY, JSON.stringify({ v: 1, days: kept })); } catch { /* a private window or a full disk: kept for the visit */ }
    tell();
  }

  return {
    record,
    subscribe(cb: () => void) { load(); listeners.add(cb); return () => { listeners.delete(cb); }; },
    snapshot(): string[] { load(); return kept; },
    /** Another tab wrote the key. */
    adopt(raw: string | null) { const d = parse(raw); if (d) { kept = d; tell(); } },
    /** What the questions store holds when it loads: every day its answers show. */
    onLoad(q: QuestionsData, now: number) { record(questionDays(q), dayOf(now)); },
    /** A change to the questions data: the days of every answer it touched, as they were and as they are now (the answer's own time moves with the edit). */
    onChange(base: QuestionsData, next: QuestionsData, now: number) { record(dayChanges(base, next), dayOf(now)); },
  };
}

let browserKeep: ReturnType<typeof makeDayKeep> | null = null;
export function dayKeep() {
  if (!browserKeep) {
    browserKeep = makeDayKeep(() => (typeof window === "undefined" ? null : window.localStorage));
    if (typeof window !== "undefined") {
      const keep = browserKeep;
      window.addEventListener("storage", (e) => { if (e.key === DAYS_KEY) keep.adopt(e.newValue); });
    }
  }
  return browserKeep;
}
