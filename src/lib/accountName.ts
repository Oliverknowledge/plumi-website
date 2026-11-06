/**
 * The name to show for a signed-in student, from the account's `user_metadata`.
 *
 * Google puts `full_name` and `name` there as strings. Apple shares a name only the first time someone signs in, and
 * only if they let it: Supabase then stores it as `full_name` or `name`, a string, though a provider can also send the
 * parts (`firstName`/`lastName`, snake_case or camelCase). Anyone who hid it, or signed in with Apple before this
 * website existed, has no name at all, so the answer is null and the caller falls back to the email address.
 */
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function displayName(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  const direct = text(meta.full_name) ?? text(meta.name);
  if (direct) return direct;
  const parts = (meta.name ?? meta.full_name) as Record<string, unknown> | string | undefined;
  if (parts && typeof parts === "object") {
    const joined = [text(parts.firstName ?? parts.first_name ?? parts.givenName), text(parts.lastName ?? parts.last_name ?? parts.familyName)].filter(Boolean).join(" ");
    if (joined) return joined;
  }
  return text(meta.given_name);
}
