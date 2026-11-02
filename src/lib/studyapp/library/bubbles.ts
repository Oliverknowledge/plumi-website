import type { LibraryMessage } from "@/lib/social/lobby";

/**
 * Speech bubbles over heads: what the room shows for a chat message that has just arrived. DISPLAY ONLY. Which
 * messages exist, and whether they are allowed, is the visit's business (filters, reports, mutes); a bubble is
 * only ever drawn for a message the chat itself holds, and never for one the chat does not show.
 *
 * Rules, all here so they can be tested: history is not replayed (the first read after joining, or after
 * switching library, sets the baseline); one bubble per person at a time (their newest); a hidden message gets none;
 * the text is short; a bubble lives `BUBBLE_MS`.
 */

/** How long a bubble stays (the page fades it out over its last second). */
export const BUBBLE_MS = 6000;
/** Longest a bubble reads (whole characters); longer text ends in an ellipsis. The chat shows all of it. */
export const BUBBLE_CHARS = 56;
/** Most bubbles drawn at once; a newer one pushes the oldest out. */
export const BUBBLE_MAX = 4;

export interface Bubble {
  /** The message it is for. */
  id: string;
  /** The room's name for the person: their id, or "you". */
  who: string;
  text: string;
}

/** A message as a bubble reads it: one line, spaces tidied, cut on whole characters (never mid emoji). */
export function bubbleText(body: string): string {
  const chars = Array.from(body.replace(/\s+/g, " ").trim());
  return chars.length <= BUBBLE_CHARS ? chars.join("") : chars.slice(0, BUBBLE_CHARS - 1).join("").trimEnd() + "…";
}

/** Remembers which messages it has seen, and says which are new. One per visit; ask it every time the messages change. */
export class BubbleFeed {
  private seen: Set<string> | null = null;
  private readonly me: string;

  constructor(me: string) { this.me = me.toLowerCase(); }

  /**
   * The bubbles to draw now: for each person, their newest message that has arrived since the last ask. Until the
   * chat has loaded, and on the first ask after it does, nothing (what was said before you looked is not replayed).
   */
  feed(messages: readonly LibraryMessage[], chatLoaded: boolean): Bubble[] {
    if (!chatLoaded) { this.seen = null; return []; }
    if (this.seen === null) { this.seen = new Set(messages.map((m) => m.id)); return []; }
    const seen = this.seen;
    const newest = new Map<string, Bubble>();
    for (const m of messages) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (m.hidden) continue;
      const text = bubbleText(m.body);
      if (text === "") continue;
      const sender = m.senderId.toLowerCase();
      newest.delete(sender);                         // later in the list is newer: it takes the person's place, and goes last
      newest.set(sender, { id: m.id, who: sender === this.me ? "you" : sender, text });
    }
    if (seen.size > 1000) this.seen = new Set(messages.map((m) => m.id));
    return [...newest.values()];
  }
}
