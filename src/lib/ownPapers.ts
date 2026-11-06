/**
 * A student's own entries on a board's past paper list, for papers Plumi doesn't host, like a
 * practice set (a student asked, 1 November 2026). Only a name and an optional link to their own
 * copy, never a file. Kept the way ticks are (DoneTick.tsx): in this browser's localStorage, no
 * account needed, not synced, and nothing leaves the device. Keyed by the board's page path.
 */
export interface OwnPaper {
  id: string;
  title: string;
  url?: string;
}

const KEY = "plumi-papers-own";
export const OWN_TITLE_MAX = 80;
const URL_MAX = 2000;
const NONE: OwnPaper[] = [];

const listeners = new Set<() => void>();
let cache: { raw: string | null; all: Record<string, OwnPaper[]> } = { raw: null, all: {} };

export const cleanTitle = (input: string) => input.replace(/\s+/g, " ").trim().slice(0, OWN_TITLE_MAX).trim();

/**
 * The link to keep: "" for none, null for one we won't use. Only http and https web addresses, so a
 * `javascript:` link can never become an href. "drive.google.com/x" gets its https:// added.
 */
export function cleanLink(input: string): string | null {
  const text = input.trim();
  if (!text) return "";
  if (text.length > URL_MAX) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || !url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** What's stored, keeping only entries that would be valid if typed today: this ends up in an href. */
export function parseOwnPapers(raw: string | null): Record<string, OwnPaper[]> {
  let stored: unknown;
  try {
    stored = raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const boards = Object.entries(stored).filter(([, list]) => Array.isArray(list)) as [string, unknown[]][];
  return Object.fromEntries(boards.map(([board, list]) => {
    const seen = new Set<string>();
    const papers: OwnPaper[] = [];
    for (const item of list) {
      const { id, title, url } = (item ?? {}) as Partial<Record<keyof OwnPaper, unknown>>;
      if (typeof id !== "string" || !id || seen.has(id) || typeof title !== "string" || !cleanTitle(title)) continue;
      const link = typeof url === "string" ? cleanLink(url) : "";
      seen.add(id);
      papers.push({ id, title: cleanTitle(title), ...(link ? { url: link } : {}) });
    }
    return [board, papers];
  }));
}

function readAll() {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache.all;
  }
  if (raw !== cache.raw) cache = { raw, all: parseOwnPapers(raw) };
  return cache.all;
}

/** This board's entries, oldest first so Set 1 sits above Set 2. The same array until something changes. */
export const readOwnPapers = (board: string) => readAll()[board] ?? NONE;
export const noOwnPapers = () => NONE;

export function subscribeOwnPapers(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

function write(board: string, papers: OwnPaper[]) {
  const all = { ...readAll(), [board]: papers };
  if (!papers.length) delete all[board];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    cache = { raw: cache.raw, all }; // private browsing: kept for this page only
  }
  listeners.forEach(l => l());
}

const entry = (id: string, title: string, url: string): OwnPaper => ({ id, title, ...(url ? { url } : {}) });

export function addOwnPaper(board: string, title: string, url = "") {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  write(board, [...readOwnPapers(board), entry(id, title, url)]);
  return id;
}

export function updateOwnPaper(board: string, id: string, title: string, url = "") {
  write(board, readOwnPapers(board).map(p => (p.id === id ? entry(id, title, url) : p)));
}

export function removeOwnPaper(board: string, id: string) {
  write(board, readOwnPapers(board).filter(p => p.id !== id));
}
