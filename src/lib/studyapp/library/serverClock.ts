import { FRESH_FOR_S } from "../../social/lobby";

/**
 * The server's clock, as far as this device can tell. The library's times (when someone began focusing, when a
 * wave was made, when a row was last written) are the SERVER's; the screens measure them against the device's
 * clock, and a student's clock can be minutes out ("5 minutes behind shows no focus tag", "ahead shows the wrong
 * minutes", "8 seconds out and every wave is missed"). So the visit learns the difference and writes every server
 * time it is given into this device's frame, once, where it comes in. Nothing downstream needs to know.
 *
 * Two sources, the better first:
 *   - the `Date` header of the server's answers (serverTime.ts): whole seconds, good to about a second;
 *   - the rows themselves, for when there is no header (a test, a proxy that strips it): `lobby_people` lists only
 *     rows written in the last `FRESH_FOR_S` seconds, so the server's "now" lies between the newest row's time
 *     and the oldest row's time plus that window. A device clock outside that range is pulled to its nearest
 *     edge. Never worse than the age of the freshest row (ten seconds when anyone is standing in the room).
 *
 * What would make it exact: a `server_now` (clock_timestamp()) returned with `lobby_people`.
 */
export class ServerClock {
  private correction = 0;
  private lastHint: number | null = null;

  /** `hint`: the header's estimate of server minus device, or null while there is none. */
  constructor(private hint: () => number | null = () => null) {}

  /** Server time minus device time, in milliseconds. */
  offset(): number {
    const h = this.hint();
    if (h !== this.lastHint) { this.lastHint = h; this.correction = 0; }
    const base = h !== null && Math.abs(h) >= 1_500 ? h : 0;      // a second or so out is the header's own grain, not a skewed clock
    return base + this.correction;
  }

  /** Server time as the device would write it down. */
  toDevice(serverMs: number): number { return serverMs - this.offset(); }
  /** The server's now. */
  now(deviceNow: number): number { return deviceNow + this.offset(); }

  /** The `updated_at` times (server's) of the rows a `lobby_people` read has just listed, at device time `deviceNow`. */
  observe(updatedAts: readonly number[], deviceNow: number): void {
    const rows = updatedAts.filter((t) => t > 0);
    if (rows.length === 0) return;
    const lo = Math.max(...rows), hi = Math.min(...rows) + FRESH_FOR_S * 1000;
    const est = this.now(deviceNow);
    if (est < lo) this.correction += lo - est;
    else if (est > hi) this.correction -= est - hi;
  }
}
