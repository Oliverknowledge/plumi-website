/**
 * Which Supabase auth errors mean "this sign-in is gone for good" and which only mean "could not reach the server". Pure, so it is tested (authErrors.test.ts).
 * Signing a student out in their browser is done ONLY for the first kind: a flaky connection must never sign anyone out.
 */
export interface AuthErrorLike { name?: string; status?: number; code?: string; message?: string }

const DEAD_CODES = new Set(["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired"]);

/** Could not reach the server, or it was busy or down: nothing is known, so nothing is changed. */
export function isOfflineError(e: AuthErrorLike | null | undefined): boolean {
  if (!e) return false;
  if (e.name === "AuthRetryableFetchError") return true;
  const s = e.status;
  return s === undefined || s === 0 || s === 429 || s >= 500;
}

/** The server has plainly ended this session: an invalid, used or unknown refresh token, or no session at all. Never a network or server error. */
export function isDeadSession(e: AuthErrorLike | null | undefined): boolean {
  if (!e || (e.name !== "AuthSessionMissingError" && isOfflineError(e))) return false;
  if (e.name === "AuthSessionMissingError") return true;
  if (e.code && DEAD_CODES.has(e.code)) return true;
  return (e.status === 400 || e.status === 401) && /refresh token/i.test(e.message ?? "");
}
