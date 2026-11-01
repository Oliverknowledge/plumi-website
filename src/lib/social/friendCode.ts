/**
 * A friend or group code: eight characters from an alphabet with no 0, O, 1 or I, shown XXXX-XXXX.
 * The app's FriendCode.swift, and 0104's generator, use the same alphabet.
 */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

/** A code as typed or pasted (case, spaces and a hyphen ignored), or null when it is not one. */
export function parseCode(raw: string): string | null {
  const squeezed = raw.toUpperCase().replace(/[\s-]/g, "");
  if (squeezed.length !== CODE_LENGTH) return null;
  for (const ch of squeezed) if (!CODE_ALPHABET.includes(ch)) return null;
  return squeezed;
}

export const displayCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/**
 * Invite links: /f/<code> for a friend, /g/<code> for a group. The iPad writes them on plumi.app
 * (SocialInvite.swift), a domain we do not own, so any host is accepted when reading one; the web app
 * writes them on tryplumi.app (`inviteUrl`). The site does not serve those paths yet (docs/study/multiplayer.md).
 */
export type Invite = { kind: "friend" | "group"; code: string };

/** The link to share for a code, on the domain we own. */
export function inviteUrl(kind: Invite["kind"], code: string, origin = "https://tryplumi.app") {
  return `${origin}/${kind === "friend" ? "f" : "g"}/${code}`;
}

export function parseInvite(url: string): Invite | null {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  const m = /^\/(f|g)\/([^/]+)\/?$/.exec(parsed.pathname);
  if (!m) return null;
  const code = parseCode(m[2]);
  return code ? { kind: m[1] === "f" ? "friend" : "group", code } : null;
}

/** The first code found in pasted text: a link, a whole code, or a word that is one. */
export function findCode(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const word of trimmed.split(/\s+/)) {
    const invite = parseInvite(word);
    if (invite) return invite.code;
  }
  const whole = parseCode(trimmed);
  if (whole) return whole;
  const words = trimmed.toUpperCase().split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
  const passes: ((w: string) => boolean)[] = [
    (w) => w.length === 9 && w[4] === "-",
    (w) => /\p{N}/u.test(w),
    () => true,
  ];
  for (const pass of passes) for (const w of words) if (pass(w)) { const c = parseCode(w); if (c) return c; }
  return null;
}
