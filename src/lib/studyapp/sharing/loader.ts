import type { SharedDeck } from "./contract";
import { sharingSwitchedOff } from "./contract";
import type { ShareReason } from "./lines";
import type { ShareResult } from "./service";

/**
 * What the public page does with the database's answer. Pure (the read and the clock are passed in), so it is tested.
 *
 *   deck      the deck
 *   gone      every way the deck is simply not there: unknown, stopped, hidden, a project without the migration, none configured
 *   crowded   `rate_limited`: the database's throttle is per caller and every page render comes from the site's own server address,
 *             so a busy minute says nothing about this deck. Never the "not shared any more" wording.
 *   busy      only a connection that failed: worth another try
 */
export type Loaded = { kind: "deck"; deck: SharedDeck } | { kind: "gone" } | { kind: "crowded" } | { kind: "busy" };

export function classify(r: ShareResult<SharedDeck>): Loaded {
  if (r.ok) return { kind: "deck", deck: r.value };
  const reason: ShareReason = r.reason;
  if (reason === "rate_limited") return { kind: "crowded" };
  return reason === "offline" || reason === "busy" || reason === "other" ? { kind: "busy" } : { kind: "gone" };
}

/** A deck found is kept this long (per server instance, per code) to spare the database; a stopped deck is gone within it. Nothing else is kept. */
export const KEEP_MS = 20_000;
const MAX_KEPT = 200;

export function makeLoader(read: (code: string) => Promise<ShareResult<SharedDeck>>, now: () => number = Date.now) {
  const kept = new Map<string, { at: number; deck: SharedDeck }>();
  return async function load(code: string): Promise<Loaded> {
    if (sharingSwitchedOff()) return { kind: "gone" };
    const hit = kept.get(code);
    if (hit && now() - hit.at < KEEP_MS) return { kind: "deck", deck: hit.deck };
    kept.delete(code);
    const out = classify(await read(code));
    if (out.kind === "deck") {
      if (kept.size >= MAX_KEPT) kept.delete(kept.keys().next().value as string);
      kept.set(code, { at: now(), deck: out.deck });
    }
    return out;
  };
}
