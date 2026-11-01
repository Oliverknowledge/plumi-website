/**
 * Every call returns a Result, never throws at a view: a student must never see an error. A failure is
 * a value the screen turns into a quiet state (the last loaded list, one short line, or nothing). This
 * mirrors SocialFailure and SocialRefusal in the iPad app (SocialService.swift), including the lines.
 */

export type Refusal =
  | "unknown_code" | "own_code" | "rate_limited" | "group_full" | "too_many_groups" | "name_rejected"
  | "not_allowed" | "not_member"
  | "message_empty" | "message_too_long" | "message_link" | "message_language" | "message_rate"
  | "message_spam" | "message_shouting" | "message_repeat" | "message_muted"
  | "other";

export type Failure =
  | { kind: "notConfigured" }
  | { kind: "signedOut" }
  | { kind: "notOptedIn" }
  | { kind: "offline" }
  | { kind: "unavailable" }
  | { kind: "refused"; reason: Refusal };

export type Result<T> = { ok: true; value: T } | { ok: false; failure: Failure };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(failure: Failure): Result<T> => ({ ok: false, failure });

/** One short line the student may read. No em dashes, never a code or a rule's inner workings. */
export function studentFacing(reason: Refusal): string {
  switch (reason) {
    case "unknown_code":
    case "not_allowed": return "That code didn’t work";
    case "own_code": return "That’s your own code";
    case "rate_limited": return "That’s enough for today. Try again tomorrow";
    case "group_full": return "That group is full";
    case "too_many_groups": return "You can run up to 5 groups";
    case "name_rejected": return "Try another name";
    case "not_member": return "You’re not in this group any more";
    case "message_empty": return "Write something first";
    case "message_too_long": return "Keep it under 280 characters";
    case "message_link": return "No links or contact details";
    case "message_language": return "No swearing, please";
    case "message_rate": return "Slow down a little";
    case "message_spam": return "That looks like spam. Say something real";
    case "message_shouting": return "Easy on the capitals";
    case "message_repeat": return "You already said that";
    case "message_muted": return "Chat is paused for you for a bit";
    case "other": return "That didn’t work. Try again later";
  }
}

/** A failure that means "keep showing what you last loaded". */
export const isTransient = (f: Failure) => f.kind === "offline" || f.kind === "unavailable" || f.kind === "signedOut";

/**
 * The migrations `RAISE EXCEPTION 'social:<reason>'`; PostgREST returns it as the error's message.
 * Every reason the server raises is named here; anything else is not the student's to act on.
 * (Same table as SupabaseSocialService.raised in the app.)
 */
export function raised(message: string): Failure | null {
  const at = message.toLowerCase().indexOf("social:");
  if (at < 0) return null;
  const reason = /^[a-z_]+/.exec(message.toLowerCase().slice(at + 7))?.[0] ?? "";
  switch (reason) {
    case "not_signed_in": return { kind: "signedOut" };
    case "not_opted_in": return { kind: "notOptedIn" };
    case "name_refused": return { kind: "refused", reason: "name_rejected" };
    case "group_limit": return { kind: "refused", reason: "too_many_groups" };
    case "rate_limited": return { kind: "refused", reason: "rate_limited" };
    case "not_owner":
    case "self": return { kind: "refused", reason: "not_allowed" };
    case "bad_presence":
    case "bad_emote":
    case "bad_visibility": return { kind: "unavailable" };
    case "not_member": return { kind: "refused", reason: "not_member" };
    case "message_empty":
    case "message_too_long":
    case "message_link":
    case "message_language":
    case "message_rate":
    case "message_spam":
    case "message_shouting":
    case "message_repeat":
    case "message_muted": return { kind: "refused", reason };
    default: return { kind: "refused", reason: "other" };
  }
}

/** What supabase-js (PostgREST) hands back when a call fails. */
export interface ApiError { message: string; code?: string; status?: number }

/** An error from the transport, as a Failure. A missing function (migration not applied) is `unavailable`, not a student's problem. */
export function failureFor(error: ApiError): Failure {
  const refused = raised(error.message);
  if (refused) return refused;
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(error.message)) return { kind: "offline" };
  if (error.status === 401 || /jwt|not authenticated/i.test(error.message)) return { kind: "signedOut" };
  if (error.status === 403 || error.code === "42501") return { kind: "refused", reason: "not_allowed" };
  // PGRST202 / 404: the function (or table) is not on this project: an older server.
  return { kind: "unavailable" };
}
