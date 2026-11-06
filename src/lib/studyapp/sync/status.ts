/**
 * What a student may be told about their backup: three states and one calm note. Nothing else ever reaches a screen: no codes, no "failed", no
 * names of anything that happens behind the page. Every failure, whatever it was, is "Waiting for a connection" and a quiet retry.
 * The words are here (not in the component) so a test can hold them to the house rules: no em dash, none of the vocabulary of the machinery.
 */
export type Phase = "off" | "backed_up" | "backing_up" | "waiting";
export interface Status { phase: Phase; /** Something was set aside (a safety cap): one calm note beside "Backed up". */ note: boolean }

export const COPY = {
  title: "Back up my notes",
  backed_up: "Backed up",
  backing_up: "Backing up",
  waiting: "Waiting for a connection",
  note: "Some items aren't backed up yet",
  /** The line under the switch while it is off. */
  offLine: "Your decks, cards and tasks stay on this device.",
  /** The line under the switch while it is on. */
  onLine: "Turning it off leaves your backup as it is.",
} as const;

export const OFF: Status = { phase: "off", note: false };

export type Event =
  | { type: "enabled" }
  | { type: "disabled" }
  /** A change was made here, or a pass is about to start. */
  | { type: "pending" }
  | { type: "done"; notBackedUp: boolean }
  /** Any failure of any kind, or no connection. */
  | { type: "failed" };

export function reduce(s: Status, e: Event): Status {
  switch (e.type) {
    case "enabled": return { phase: "backing_up", note: false };
    case "disabled": return OFF;
    case "pending": return s.phase === "off" ? s : { phase: "backing_up", note: s.note };
    case "done": return s.phase === "off" ? s : { phase: "backed_up", note: e.notBackedUp };
    case "failed": return s.phase === "off" ? s : { phase: "waiting", note: s.note };
  }
}

/** The line to draw for a status (null while off). */
export const lineFor = (s: Status): string | null => (s.phase === "off" ? null : COPY[s.phase]);

/** Everything a student can read from this feature, for the tests that hold it to the house rules. */
export const studentStrings = (): string[] => Object.values(COPY);
