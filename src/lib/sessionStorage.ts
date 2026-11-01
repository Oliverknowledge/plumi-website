/**
 * Where the Supabase session lives, so one sign-in covers tryplumi.app and study.tryplumi.app.
 *
 * A browser keeps localStorage per address, so a session stored there on the website was invisible to the app
 * (a different host). A cookie can be shared: on tryplumi.app, www.tryplumi.app and study.tryplumi.app it is
 * written for `.tryplumi.app`, so signing in on either is signing in on both. Anywhere else (localhost, a
 * preview deployment) it is an ordinary cookie for that host only.
 *
 * What this costs, said plainly:
 *  - The session is readable by script on every host under .tryplumi.app. localStorage was readable by script on
 *    one host; a cookie that has to be shared cannot be HttpOnly, because the browser client reads it.
 *  - The browser sends it to our servers with every request to those hosts. Nothing reads it there.
 *  - A session is ~2 to 3 KB and a cookie holds ~4 KB, so it is stored in chunks (name.0, name.1, ...), as
 *    base64url so no byte needs escaping.
 *  - Another tab on the other host is not told live when this one signs out; it finds out on its next load.
 *
 * Sessions that already live in localStorage (everyone signed in before this) are moved to the cookie the first
 * time they are read, so nobody is signed out by the change.
 *
 * `makeSessionStorage` is pure (the cookie jar and the host are passed in) so it is tested without a browser.
 */

export type Jar = { read(): string; write(cookie: string): void };
export type Legacy = { getItem(k: string): string | null; removeItem(k: string): void };
export type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

const SHARED = ".tryplumi.app";
/** Characters of one cookie's value. A browser allows ~4096 bytes for name, value and attributes together. */
export const CHUNK = 3000;
/** Chrome caps cookie lifetime at 400 days; the session is renewed each time it is refreshed. */
const MAX_AGE = 400 * 24 * 3600;

/** `.tryplumi.app` for the website and the app; nothing (this host only) anywhere else. */
export function cookieDomain(hostname: string) {
  const h = hostname.toLowerCase();
  return h === "tryplumi.app" || h.endsWith(".tryplumi.app") ? SHARED : undefined;
}

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64 = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

function parse(header: string) {
  const out = new Map<string, string>();
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  return out;
}

export function makeSessionStorage(opts: { jar: Jar; hostname: string; secure: boolean; legacy?: Legacy | null }): StorageLike {
  const domain = cookieDomain(opts.hostname);
  const attrs = (maxAge: number) => `; Path=/; Max-Age=${maxAge}; SameSite=Lax${opts.secure ? "; Secure" : ""}${domain ? `; Domain=${domain}` : ""}`;
  const name = (key: string, i: number) => `${key}.${i}`;

  function readCookie(key: string): string | null {
    const all = parse(opts.jar.read());
    let joined = "";
    for (let i = 0; all.has(name(key, i)); i++) joined += all.get(name(key, i));
    if (!joined) return null;
    try { return unb64(joined); } catch { return null; }
  }
  function writeCookie(key: string, value: string) {
    const encoded = b64(value);
    const chunks: string[] = [];
    for (let i = 0; i < encoded.length; i += CHUNK) chunks.push(encoded.slice(i, i + CHUNK));
    const had = parse(opts.jar.read());
    chunks.forEach((c, i) => opts.jar.write(`${name(key, i)}=${c}${attrs(MAX_AGE)}`));
    // A shorter session than before leaves its old tail behind: remove it, or it would be glued on at read.
    for (let i = chunks.length; had.has(name(key, i)); i++) opts.jar.write(`${name(key, i)}=${attrs(0)}`);
  }
  function clearCookie(key: string) {
    const had = parse(opts.jar.read());
    for (let i = 0; had.has(name(key, i)); i++) opts.jar.write(`${name(key, i)}=${attrs(0)}`);
  }

  return {
    getItem(key) {
      const fromCookie = readCookie(key);
      if (fromCookie !== null) return fromCookie;
      // Signed in before the cookie existed: move the session across, once.
      const old = opts.legacy?.getItem(key) ?? null;
      if (old !== null) { writeCookie(key, old); opts.legacy?.removeItem(key); }
      return old;
    },
    setItem(key, value) { writeCookie(key, value); opts.legacy?.removeItem(key); },
    removeItem(key) { clearCookie(key); opts.legacy?.removeItem(key); },
  };
}

/** The browser's: document.cookie, for this host, with localStorage as the old home. */
export function browserSessionStorage(): StorageLike {
  let legacy: Legacy | null = null;
  try { legacy = window.localStorage; } catch { /* blocked storage: cookies alone */ }
  return makeSessionStorage({
    jar: { read: () => document.cookie, write: (c) => { document.cookie = c; } },
    hostname: window.location.hostname,
    secure: window.location.protocol === "https:",
    legacy,
  });
}
