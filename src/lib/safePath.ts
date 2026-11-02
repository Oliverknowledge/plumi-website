/**
 * Whether `next` is a path on THIS site and nowhere else, for "come back to where you were" after signing in.
 *
 * A browser forgives more than a string check does: it deletes tabs and line breaks from an address and reads a
 * backslash as a slash, so "/\evil.example", "/<tab>/evil.example" and "/%5Cevil.example" (once decoded) all LEAVE the
 * site while starting with a single "/". So reject any backslash and any control character anywhere, a second slash
 * right after the first, and anything that does not resolve to the same origin.
 */
export function isSitePath(next: string | null | undefined): next is string {
  if (!next || next.length > 2048) return false;
  if (!next.startsWith("/") || next.startsWith("//")) return false;
  if (next.includes("\\") || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(next)) return false;
  try {
    const base = "https://site.invalid";
    return new URL(next, base).origin === base;
  } catch {
    return false;
  }
}
