/**
 * Deleting an account from the web: the same server call the iPad app makes (`delete_own_account()`, Supabase migration 0103: it takes no arguments, so the only account it can
 * delete is the caller's own). This file is the flow, with its edges handed in, so it can be tested without a server or a browser: the confirm gate, the order of things, and what
 * the student is told when it does not work. Nothing here names the server's functions or checks to a student.
 */
export const CONFIRM_WORD = "DELETE";

/** The deliberate step: the word typed (any case, spaces round it ignored). */
export const confirmOk = (typed: string): boolean => typed.trim().toUpperCase() === CONFIRM_WORD;

export type DeleteResult = { ok: true } | { ok: false; message: string };

export interface DeleteDeps {
  /** The call to the server. Resolves with an error (or null); it may also throw (no network). */
  rpc(): Promise<{ error: { message?: string; code?: string; status?: number } | null }>;
  /** Forget the session in this browser only: the account is gone, so there is nobody for the server to sign out. */
  signOutLocal(): Promise<unknown>;
  /** Clear Plumi's own saved work on this device. */
  clearDevice(): Promise<unknown>;
}

/** Plain words for what went wrong, never the server's. */
export function friendlyDeleteError(e: { message?: string; code?: string; status?: number } | null | undefined): string {
  const m = `${e?.message ?? ""}`.toLowerCase();
  if (e?.status === 401 || e?.status === 403 || /jwt|token|not authenticated|authenticated caller|expired/.test(m)) return "Your sign-in has run out. Sign in again, then try once more.";
  if (!e || /fetch|network|timeout|timed out|abort|failed to load|offline/.test(m) || e.status === 0 || e.status === 408 || e.status === 502 || e.status === 503 || e.status === 504) return "We could not reach Plumi. Check your connection and try again. Nothing has been deleted.";
  return "Something went wrong and your account was not deleted. Try again, or email hello@tryplumi.app.";
}

/**
 * Confirm word first (nothing is sent without it), then the server, then, only if the server said yes, sign out here and (if ticked) clear this device. A failure signs nobody out
 * and clears nothing.
 */
export async function deleteAccount(deps: DeleteDeps, opts: { typed: string; clearDevice: boolean }): Promise<DeleteResult> {
  if (!confirmOk(opts.typed)) return { ok: false, message: `Type ${CONFIRM_WORD} to confirm.` };
  let res: Awaited<ReturnType<DeleteDeps["rpc"]>>;
  try { res = await deps.rpc(); } catch (e) { return { ok: false, message: friendlyDeleteError({ message: e instanceof Error ? e.message : String(e) }) }; }
  if (res.error) return { ok: false, message: friendlyDeleteError(res.error) };
  // The account is gone. Whatever happens next, it is deleted: these steps never turn that into an error.
  try { await deps.signOutLocal(); } catch { /* the session is dropped below by the page leaving */ }
  if (opts.clearDevice) { try { await deps.clearDevice(); } catch { /* best effort: said on the screen the student lands on */ } }
  return { ok: true };
}

/** Appearance and the ad-measurement choice belong to the device, not the account: they stay. */
const KEEP = new Set(["plumi-theme", "plumi-look", "plumi-ad-consent"]);

/** Every key Plumi keeps in a Storage (plumi-study-*, the feed, the pen, the library...) except the device's own choices. Returns how many were removed. */
export function clearPlumiKeys(store: Pick<Storage, "length" | "key" | "removeItem">): number {
  const names: string[] = [];
  for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && /^plumi[-.]/.test(k) && !KEEP.has(k)) names.push(k); }
  for (const k of names) store.removeItem(k);
  return names.length;
}
