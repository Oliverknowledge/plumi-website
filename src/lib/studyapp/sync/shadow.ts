import type { CardKeep, ServerCard, ServerDeck, ServerTask, TaskKeep } from "./mapper";
import type { RefusalReason } from "./contract";

/**
 * The shadow: what the server last confirmed, row by row, kept in localStorage under its own key BESIDE the study app's data (never inside it),
 * one per account. The study app's own saves know nothing about it; a row is "changed here" when its fingerprint differs from the shadow's, and
 * "deleted here" when the shadow has it and the app no longer does. If storage is missing, full or blocked, nothing is lost: the shadow lives on in
 * memory for the visit and, once gone, the next pass is the ordinary first-time merge (everything pushes with revision 0, the server settles it).
 */

export type Kind = "deck" | "card" | "task";
export const rowKey = (kind: Kind, id: string): string => `${kind}:${id}`;
export const keyId = (key: string): string => key.slice(key.indexOf(":") + 1);
export const keyKind = (key: string): Kind => key.slice(0, key.indexOf(":")) as Kind;

/** When a change was first noticed here (hash, time), per group, so a change made offline keeps its own time when it is pushed later. x: a deletion. */
export interface Noticed { c?: [string, number]; s?: [string, number]; w?: [string, number]; x?: number }

export interface RowShadow {
  /** The server's revision of the row when last confirmed. */
  rev: number;
  /** Deck and card: the revision of the content group. */
  crev?: number;
  /** Card: the revision of the schedule group. */
  srev?: number;
  /** Deck and task: fingerprint of the local row the last time it matched the server. */
  h?: string;
  /** Card: the same, per group. */
  hc?: string;
  hs?: string;
  /** Card: its deck, and when it was made (a deletion needs both). */
  d?: string;
  ca?: number;
  /** What is kept beside the row about parts the website does not show (the iPad's schedule extras, picture file names, position, filed time, order). */
  keep?: CardKeep & TaskKeep;
  n?: Noticed;
  /** The server has it deleted, or it is hidden with its deck: nothing to push, nothing to show. */
  dead?: true;
  /** Deck: the server deleted it while this device still has unsent work in it; it is kept here until that work has gone up. */
  tomb?: true;
  /** The server's row, kept as it came because the website does not show it (a repeating or hand-written task, a card whose deck has not arrived). */
  held?: ServerCard | ServerTask | ServerDeck;
}

export interface Refused { reason: RefusalReason; /** the row's fingerprint when it was refused */ sig: string; at: number }

export interface Shadow {
  v: 1;
  account: string;
  /** The pull cursor: every row up to this revision has been seen. */
  cursor: number;
  rows: Record<string, RowShadow>;
  /** Rows the server would not take (a safety cap). Remembered so they are not sent again every pass: "not backed up". */
  refused: Record<string, Refused>;
  /** A deleted deck came back: read everything again once, so its cards come back with it. */
  repull?: boolean;
}

export const emptyShadow = (account: string): Shadow => ({ v: 1, account, cursor: 0, rows: {}, refused: {} });

export const shadowKey = (account: string): string => `plumi-sync-shadow:${account}`;
export const optInKey = (account: string): string => `plumi-sync-on:${account}`;
export const DEVICE_KEY = "plumi-sync-device";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The saved shadow of this account, or an empty one (nothing saved, unreadable, or saved for someone else). */
export function loadShadow(store: Store | null, account: string): Shadow {
  try {
    const raw = store?.getItem(shadowKey(account));
    if (!raw) return emptyShadow(account);
    const s = JSON.parse(raw) as Partial<Shadow>;
    if (!s || s.v !== 1 || s.account !== account || typeof s.cursor !== "number" || !s.rows || typeof s.rows !== "object") return emptyShadow(account);
    return { v: 1, account, cursor: s.cursor, rows: s.rows, refused: s.refused && typeof s.refused === "object" ? s.refused : {}, repull: s.repull === true ? true : undefined };
  } catch {
    return emptyShadow(account);
  }
}

/** Save it. False when storage would not take it (the caller carries on: it is only a cache of what the server knows). */
export function saveShadow(store: Store | null, shadow: Shadow): boolean {
  try {
    if (!store) return false;
    store.setItem(shadowKey(shadow.account), JSON.stringify(shadow));
    return true;
  } catch {
    return false;
  }
}

export function readOptIn(store: Store | null, account: string): boolean {
  try { return store?.getItem(optInKey(account)) === "1"; } catch { return false; }
}
export function writeOptIn(store: Store | null, account: string, on: boolean): boolean {
  try {
    if (!store) return false;
    if (on) store.setItem(optInKey(account), "1"); else store.removeItem(optInKey(account));
    return true;
  } catch { return false; }
}

/** This browser's id for the server ("web-" and 12 letters and digits): made once, kept; if storage will not keep it, one per visit. */
let visitDevice: string | null = null;
export function deviceId(store: Store | null, random: () => number = Math.random): string {
  try { const v = store?.getItem(DEVICE_KEY); if (v && /^[A-Za-z0-9._-]{8,64}$/.test(v)) return v; } catch { /* below */ }
  const make = () => { let s = "web-"; for (let i = 0; i < 12; i++) s += "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(random() * 36)]; return s; };
  visitDevice ??= make();
  try { store?.setItem(DEVICE_KEY, visitDevice); } catch { /* kept for this visit only */ }
  return visitDevice;
}
export const resetDeviceForTests = () => { visitDevice = null; };

/** How many things the server has refused and are still not backed up. */
export const notBackedUp = (s: Shadow): number => Object.keys(s.refused).length;
