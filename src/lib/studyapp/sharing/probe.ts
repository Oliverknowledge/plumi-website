import { isMissingFunction } from "@/lib/social/failure";
import { SHARE_RPC } from "./contract";
import { codeIn } from "./lines";
import type { ShareApi } from "./service";

/**
 * Is sharing on in this project? The founder applies the sharing migration himself, later; until then nothing about sharing may
 * look broken. So the app asks once per visit, and while the answer is "no" Share is simply not drawn.
 *
 *   on        the function answered (even with "not_found" for the made-up code below)
 *   off       the project has no such function (PostgREST 404, PGRST202, "could not find the function"), or no project is configured
 *   unknown   the connection failed, so nothing is known: Share stays hidden and the question is asked again next time
 *
 * The question is `get_shared_deck` with a well-formed code that cannot exist: it needs no sign-in, writes nothing, and a project
 * that has the function always answers it (not_found or bad_request). Only a definite answer is remembered.
 */
export type Availability = "on" | "off" | "unknown";

/** A well-formed code nobody holds: 16 characters of one letter. */
export const PROBE_CODE = "zzzzzzzzzzzzzzzz";

export async function probeSharing(api: ShareApi): Promise<Availability> {
  if (!api.configured) return "off";
  try {
    const { error } = await api.rpc(SHARE_RPC.get.name, { p_code: PROBE_CODE });
    if (!error) return "on";
    if (isMissingFunction(error)) return "off";
    if (codeIn(error.message)) return "on";
    return "unknown";
  } catch {
    return "unknown";
  }
}

const KEY = "plumi-share-probe";

/** The probe's answer for this visit: asked once, shared by every caller, remembered for the session (tab) when it was definite. */
export function makeProbe(api: ShareApi, storage: Pick<Storage, "getItem" | "setItem"> | null) {
  let settled: Availability | null = null;
  let inflight: Promise<Availability> | null = null;
  const read = (): Availability | null => {
    try { const v = storage?.getItem(KEY); return v === "on" || v === "off" ? v : null; } catch { return null; }
  };
  return {
    /** The remembered answer, or null if there is none yet. Synchronous, so a screen can draw straight away. */
    peek(): Availability | null { return settled ?? (settled = read()); },
    async ask(): Promise<Availability> {
      const known = this.peek();
      if (known) return known;
      inflight ??= probeSharing(api).then((a) => {
        if (a !== "unknown") {
          settled = a;
          try { storage?.setItem(KEY, a); } catch { /* fine without */ }
        }
        inflight = null;
        return a;
      });
      return inflight;
    },
  };
}
