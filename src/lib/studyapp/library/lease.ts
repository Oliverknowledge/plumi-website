/**
 * One tab at a time in the library, per student.
 *
 * The server keeps ONE row per student (`lobby_presence`), so two tabs of the same account fight over it: each
 * one's join takes the row from the other, each sees the other's answer as "you are not in this library any
 * more" and joins again, round and round (measured: 64 joins in 45 seconds, and the seat flipping between
 * sitting and standing). The cure is not a smarter server call but a rule: only one tab per account is in the
 * library; any other says so calmly and offers to move here. Moving is a deliberate tap, never automatic.
 *
 * The lease is a Web Lock named for the student. A lock is held for as long as the holding tab lives and is
 * released by the browser the moment that tab closes or crashes, so no heartbeat can go stale and no tab is
 * ever locked out by one that has gone. `steal` is the lock API's own way to take it from a live holder, which
 * is told (its promise is rejected) so it can stop at once. Where the Web Locks API is missing (a very old
 * browser, an insecure page) there is no lease, and the tabs behave as they did before: it fails open.
 */

export interface Lease {
  /** Become the library tab if no other tab of this student is. False when another one is. */
  claim(): Promise<boolean>;
  /** Become the library tab whatever any other is; the other is told through `onLost`. */
  steal(): Promise<boolean>;
  /** Let go (you left, or the page is going). */
  release(): void;
  /** Called when another tab takes it from you. Returns what stops listening. */
  onLost(cb: () => void): () => void;
}

interface LockLike {
  request(name: string, options: { ifAvailable?: boolean; steal?: boolean }, callback: (lock: unknown) => unknown): Promise<unknown>;
}

export const leaseName = (userId: string) => `plumi-library:${userId.toLowerCase()}`;

/** The browser's lease for `userId`, or null where there are no Web Locks. */
export function browserLease(userId: string, locks: LockLike | undefined = typeof navigator !== "undefined" ? (navigator as unknown as { locks?: LockLike }).locks : undefined): Lease | null {
  if (!locks || typeof locks.request !== "function") return null;
  const name = leaseName(userId);
  let held: (() => void) | null = null;
  const lost = new Set<() => void>();

  const take = (options: { ifAvailable?: boolean; steal?: boolean }) => new Promise<boolean>((resolve) => {
    let granted = false;
    let request: Promise<unknown>;
    try {
      request = locks.request(name, options, (lock) => {
        if (!lock) { resolve(false); return undefined; }
        granted = true;
        return new Promise<void>((done) => { held = () => { held = null; done(); }; resolve(true); });
      });
    } catch { resolve(true); return; }       // the API is there but refuses us: carry on without a lease
    request.then(() => {}, () => {
      // rejected: stolen from us after it was ours, or it never worked at all
      if (granted) { held = null; for (const f of [...lost]) f(); } else resolve(true);
    });
  });

  return {
    claim: () => (held ? Promise.resolve(true) : take({ ifAvailable: true })),
    steal: () => take({ steal: true }),
    release: () => { held?.(); },
    onLost(cb) { lost.add(cb); return () => { lost.delete(cb); }; },
  };
}

/**
 * The same rule in memory, for tests and for the demo: `leases(name)` hands out leases for one student, all
 * sharing one holder.
 */
export function memoryLeases() {
  const holders = new Map<string, { id: number; lost: Set<() => void> }>();
  let next = 1;
  return (userId: string): Lease => {
    const name = leaseName(userId);
    const id = next++;
    const lost = new Set<() => void>();
    const mine = () => holders.get(name)?.id === id;
    const become = () => { holders.set(name, { id, lost }); return true; };
    return {
      claim: async () => (holders.has(name) && !mine() ? false : become()),
      steal: async () => {
        const was = holders.get(name);
        become();
        if (was && was.id !== id) for (const f of [...was.lost]) f();
        return true;
      },
      release: () => { if (mine()) holders.delete(name); },
      onLost(cb) { lost.add(cb); return () => { lost.delete(cb); }; },
    };
  };
}
