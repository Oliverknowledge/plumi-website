import { isMissingFunction, type ApiError } from "@/lib/social/failure";
import { SYNC_RPC } from "./contract";
import type { Changes, PullPage, PushResponse } from "./protocol";
import { parsePullPage, parsePushResponse } from "./protocol";

/**
 * The two calls, over the project's Supabase client. Nothing here throws at a caller: every failure (no network, a 400, a 403, a 5xx, an answer in
 * a shape nobody expected, a call that never comes back) is a value. The words below are for the code, not the student: the only things a student
 * ever sees are "Backed up", "Backing up" and "Waiting for a connection" (status.ts).
 */
export type Failure =
  /** No network, a timeout, a busy server. Try again soon. */
  | "offline"
  /** The session is not accepted (signed out, or it ran out). */
  | "signed_out"
  /** The functions are not in this project (the migration has not been applied). */
  | "unavailable"
  /** The server said no to the request (a 400) or answered in a shape nobody expected. Retrying at once will not help. */
  | "refused";
export type Result<T> = { ok: true; value: T } | { ok: false; failure: Failure };

export interface RpcApi { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: ApiError | null }> }

const OFFLINE = /failed to fetch|fetch failed|networkerror|network request failed|load failed|aborterror|signal is aborted|operation was aborted|timed? ?out|econn|enotfound|socket|offline/i;

/** An error from the transport, as a failure. */
export function failureFor(error: ApiError): Failure {
  if (isMissingFunction(error)) return "unavailable";
  if (/sync:not_signed_in/.test(error.message) || error.code === "42501" || error.status === 401 || error.status === 403 || /jwt|not authenticated|permission denied/i.test(error.message)) return "signed_out";
  if (/sync:[a-z_]+/.test(error.message)) return "refused";
  if (OFFLINE.test(error.message) || error.status === 0 || error.status === 408 || error.status === 429 || (error.status !== undefined && error.status >= 500)) return "offline";
  if (error.status !== undefined && error.status >= 400) return "refused";
  return "offline";
}

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const no = (failure: Failure): Result<never> => ({ ok: false, failure });

export const CALL_TIMEOUT_MS = 30_000;

export function createSyncClient(api: RpcApi, timeoutMs: number = CALL_TIMEOUT_MS) {
  async function call(name: string, args: Record<string, unknown>): Promise<Result<unknown>> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timed out")), timeoutMs); });
      const { data, error } = await Promise.race([api.rpc(name, args), timeout]);
      return error ? no(failureFor(error)) : ok(data);
    } catch (e) {
      return no(failureFor({ message: e instanceof Error ? e.message : String(e) }));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return {
    async push(device: string, changes: Changes): Promise<Result<PushResponse>> {
      const r = await call(SYNC_RPC.push.name, { p_device: device, p_changes: changes });
      if (!r.ok) return r;
      const parsed = parsePushResponse(r.value);
      return parsed ? ok(parsed) : no("refused");
    },
    async pull(since: number, limit: number): Promise<Result<PullPage>> {
      const r = await call(SYNC_RPC.pull.name, { p_since: since, p_limit: limit });
      if (!r.ok) return r;
      const parsed = parsePullPage(r.value);
      return parsed ? ok(parsed) : no("refused");
    },
  };
}
export type SyncClient = ReturnType<typeof createSyncClient>;
