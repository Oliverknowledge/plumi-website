/**
 * Two things every request to the server gets for free, kept in one place so neither the service nor the
 * screens need to know about them:
 *
 *   1. A TIMEOUT. A connection that goes half-open (a laptop that slept, a phone that changed network) never
 *      answers and never fails, so a visit that waited on it would stand still for good. Every call to the
 *      data API is aborted after `FETCH_TIMEOUT_MS` and comes back as an ordinary network failure, which the
 *      callers already treat as "keep what was last good and try again".
 *   2. THE SERVER'S CLOCK. Every response carries a `Date` header. From it we learn how far this device's clock
 *      is from the server's, which matters because the library's times (when someone began focusing, when a
 *      wave was made) are the server's, and a student's clock can be minutes out.
 */

export const FETCH_TIMEOUT_MS = 8_000;

let offset: number | null = null;
let bestRtt = Infinity;
let sampledAt = 0;

/**
 * One response's `Date` header (whole seconds, so the true time was within the following second), sent at
 * `sentAt` and received at `receivedAt` on this device's clock. A slow round trip says little, so it only
 * replaces a better estimate when that one has gone stale (a minute).
 */
export function noteServerDate(header: string | null | undefined, sentAt: number, receivedAt: number): void {
  if (!header) return;
  const date = Date.parse(header);
  if (!Number.isFinite(date)) return;
  const rtt = receivedAt - sentAt;
  if (rtt < 0 || rtt > 4_000) return;
  const estimate = date + 500 - (sentAt + rtt / 2);
  if (offset === null || rtt <= bestRtt + 200 || receivedAt - sampledAt > 60_000) { offset = estimate; bestRtt = rtt; sampledAt = receivedAt; }
}

/** How far the server's clock is ahead of this device's (milliseconds; negative when behind), or null while no response has said. Good to about a second. */
export const serverOffsetHint = (): number | null => offset;

/** For tests. */
export function resetServerTime(): void { offset = null; bestRtt = Infinity; sampledAt = 0; }

/**
 * `fetch` with the two above: the client's `global.fetch`. Only the data API (`/rest/v1/`) is given a timeout;
 * sign-in and token calls are left to take as long as they need.
 */
export function timedFetch(timeoutMs: number = FETCH_TIMEOUT_MS, base: typeof fetch = (...a) => fetch(...a)): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const guarded = /\/rest\/v1\//.test(url);
    const ctl = guarded ? new AbortController() : null;
    const outer = init?.signal;
    if (ctl && outer) {
      if (outer.aborted) ctl.abort(); else outer.addEventListener("abort", () => ctl.abort(), { once: true });
    }
    // not cleared on success: the body can hang as well as the headers, and an abort after the end is nothing
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : undefined;
    (timer as unknown as { unref?: () => void } | undefined)?.unref?.();
    const sentAt = Date.now();
    const res = await base(input, ctl ? { ...init, signal: ctl.signal } : init);
    noteServerDate(res.headers.get("date"), sentAt, Date.now());
    return res;
  };
}
