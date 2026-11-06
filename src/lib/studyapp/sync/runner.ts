import type { AppData } from "../model";
import { PULL_PAGE } from "./contract";
import type { Failure, SyncClient } from "./client";
import { applyPull, applyPush, planPush, refusedCount } from "./engine";
import type { Shadow } from "./shadow";

/**
 * One pass: push what changed here (in pieces of at most the per-push limit), then pull what changed elsewhere (page by page, from the cursor).
 * No timers and no storage: those are the runtime's. It never throws. With no real account it makes no call at all.
 */
export interface RunDeps {
  client: SyncClient;
  /** The signed-in account, or null. An anonymous one never syncs. */
  account: { id: string; anonymous?: boolean } | null;
  device: string;
  now(): number;
  online(): boolean;
  /** The app's data now, and a way to change it atomically (the function is called with the data at that moment). */
  getApp(): AppData;
  update(fn: (d: AppData) => AppData): void;
  /** Keep the shadow (it may be refused by full storage: the caller carries on). */
  save(s: Shadow): void;
  /** Is this still the account the pass began for? Checked after every wait; if not, the pass stops without touching anything. */
  current(): boolean;
  /** The whole pass gives up (to try again later) after this long. */
  budgetMs?: number;
}

export type Outcome =
  | { kind: "done"; shadow: Shadow; notBackedUp: number }
  | { kind: "skipped" }
  | { kind: "failed"; failure: Failure; shadow: Shadow };

const MAX_PUSHES = 100;

export async function runPass(deps: RunDeps, shadow: Shadow): Promise<Outcome> {
  const { account } = deps;
  if (!account || account.anonymous) return { kind: "skipped" };
  if (!deps.online()) return { kind: "failed", failure: "offline", shadow };
  const deadline = deps.now() + (deps.budgetMs ?? 120_000);
  const fail = (failure: Failure): Outcome => ({ kind: "failed", failure, shadow });
  const stop = (): Outcome => ({ kind: "skipped" });
  try {
    for (let i = 0; i < MAX_PUSHES; i++) {
      const plan = planPush(deps.getApp(), shadow, deps.now(), deps.device);
      shadow = plan.shadow;
      if (plan.count === 0) { deps.save(shadow); break; }
      const r = await deps.client.push(deps.device, plan.changes);
      if (!deps.current()) return stop();
      if (!r.ok) { deps.save(shadow); return fail(r.failure); }
      let progressed = false;
      deps.update((d) => { const m = applyPush(d, shadow, r.value, plan.snapshot); shadow = m.shadow; progressed = m.progressed; return m.app; });
      deps.save(shadow);
      if (!progressed || !plan.more) break;
      if (deps.now() > deadline) return fail("offline");
    }

    let restarted = false;
    for (;;) {
      if (deps.now() > deadline) return fail("offline");
      const r = await deps.client.pull(shadow.cursor, PULL_PAGE);
      if (!deps.current()) return stop();
      if (!r.ok) return fail(r.failure);
      const page = r.value;
      let restart = false;
      const before = shadow.cursor;
      deps.update((d) => { const m = applyPull(d, shadow, page); shadow = m.shadow; restart = m.restart; return m.app; });
      deps.save(shadow);
      if (restart && !restarted) { restarted = true; continue; }
      if (!page.more) break;
      if (shadow.cursor <= before) return fail("refused");   // a page that says "more" and moves nowhere would never end
    }
    return { kind: "done", shadow, notBackedUp: refusedCount(shadow) };
  } catch {
    return fail("offline");
  }
}
