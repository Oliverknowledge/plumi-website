"use client";

import { cleanInk, inkBytes, inkIds, strokesToAdd, type Ink, type Stroke } from "./ink";

/**
 * Where handwriting is kept: IndexedDB (`plumi-study-ink`, one object store `ink`, key `<setId>/<partId>`, value
 * `{ v: 1, ink: Stroke[], at }`). Not localStorage: that is about 5 MB for the whole origin and the app's other data
 * (tasks, cards, answers' text) shares it; a page of working is tens of kilobytes and a set of twelve parts can reach
 * a few megabytes. The app's document keeps only how many strokes and bytes each answer has (questions/model.ts).
 *
 * Everything works without it. If IndexedDB is missing or refuses (a private window in an older browser, blocked site
 * data, a full disk), ink is kept in memory for the visit and `inkDbOk()` says it is not being saved, so the sheet
 * says so once, calmly (PenTray). A failed write is tried once more on a fresh connection. A student never sees an error from here.
 *
 * Two tabs on one answer: every write reads the stored record in the same transaction and adds any stroke another tab
 * wrote that this one has never seen, so neither tab's strokes are lost (`strokesToAdd`); a BroadcastChannel tells the
 * other tab, which draws them. A record written by a NEWER version of the app (`v` above 1) is read but never
 * overwritten.
 *
 * Safari note: WebKit deletes a site's script-written data (localStorage, IndexedDB) after seven days without a visit
 * unless the site is added to the Home Screen. It applies to all of this app's data, not only ink (docs/study/questions.md).
 */
const DB = "plumi-study-ink";
const STORE = "ink";
const FORMAT = 1;

const mem = new Map<string, Ink>();
const loading = new Map<string, Promise<Ink>>();
/** Every stroke id this tab has held for an answer: the strokes it has seen, whether or not they are still there. */
const seen = new Map<string, Set<string>>();
/** Answers whose stored record is a newer format than this code writes: never overwritten. */
const locked = new Set<string>();
let dbp: Promise<IDBDatabase | null> | null = null;
let ok: boolean | null = null;
const listeners = new Set<() => void>();
const setOk = (v: boolean) => { if (ok !== v) { ok = v; listeners.forEach((l) => l()); } };

/** Is ink being kept on this device? null until we know. */
export const inkDbOk = () => ok;
export function onInkDbChange(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

/** Strokes another tab added to an answer, as they arrive. */
const remote = new Map<string, Set<(added: Stroke[]) => void>>();
export function onInkRemote(key: string, cb: (added: Stroke[]) => void) {
  let set = remote.get(key);
  if (!set) remote.set(key, (set = new Set()));
  set.add(cb);
  return () => { set.delete(cb); if (!set.size) remote.delete(key); };
}

function remember(key: string, ink: Ink) {
  let s = seen.get(key);
  if (!s) seen.set(key, (s = new Set()));
  for (const id of inkIds(ink)) s.add(id);
}

let channel: BroadcastChannel | null | undefined;
function chan(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(DB);
      channel.onmessage = (e: MessageEvent) => { const k = (e.data as { k?: unknown } | null)?.k; if (typeof k === "string") void refresh(k); };
    }
  } catch { channel = null; }
  return channel;
}

function open(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") { setOk(false); return resolve(null); }
      const req = indexedDB.open(DB, FORMAT);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => {
        const db = req.result;
        // Let go when asked (a newer version of the app in another tab) or when the browser closes it, and open afresh next time.
        db.onversionchange = () => { db.close(); dbp = null; };
        db.onclose = () => { dbp = null; };
        resolve(db);
      };
      req.onerror = () => { setOk(false); resolve(null); };
      req.onblocked = () => { /* another tab holds an older connection: wait for it to let go */ };
    } catch { setOk(false); resolve(null); }
  });
  return dbp;
}

interface Done<T> { ok: boolean; value?: T }

/** One transaction. `work` runs inside it and may hand back a value with `give`. */
function once<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore, give: (v: T) => void) => void): Promise<Done<T> & { gone?: boolean }> {
  return open().then((db) => new Promise<Done<T> & { gone?: boolean }>((resolve) => {
    if (!db) return resolve({ ok: false, gone: true });
    let value: T | undefined;
    try {
      const tx = db.transaction(STORE, mode);
      work(tx.objectStore(STORE), (v) => { value = v; });
      tx.oncomplete = () => resolve({ ok: true, value });
      tx.onerror = () => resolve({ ok: false });
      tx.onabort = () => resolve({ ok: false });
    } catch { resolve({ ok: false }); }
  }));
}

/** A transaction, tried once more on a fresh connection if it fails; whether it worked says whether ink is being kept. */
async function attempt<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore, give: (v: T) => void) => void): Promise<Done<T>> {
  let r = await once<T>(mode, work);
  if (!r.ok && !r.gone) {
    const db = await dbp;
    try { db?.close(); } catch { /* already closed */ }
    dbp = null;
    r = await once<T>(mode, work);
  }
  if (r.ok) setOk(true); else setOk(false);
  return r;
}

interface Rec { v?: unknown; ink?: unknown }
const newer = (rec: Rec | undefined) => !!rec && typeof rec.v === "number" && rec.v > FORMAT;

/** An answer's ink: from memory if it has been seen this visit, else from the device. Always resolves (empty if there is none). */
export function loadInk(key: string): Promise<Ink> {
  const hit = mem.get(key);
  if (hit) return Promise.resolve(hit);
  let p = loading.get(key);
  if (!p) {
    p = attempt<Rec | undefined>("readonly", (s, give) => { const g = s.get(key); g.onsuccess = () => give(g.result as Rec | undefined); }).then((r) => {
      const rec = r.value;
      if (newer(rec)) locked.add(key);
      const stored = cleanInk(rec?.ink);
      // A stroke drawn while this was loading wins; what was stored is added when it is written (strokesToAdd).
      const now = mem.get(key);
      const ink = now ?? stored;
      if (!now) { mem.set(key, ink); remember(key, ink); }
      loading.delete(key);
      return ink;
    });
    loading.set(key, p);
  }
  return p;
}

/** The ink we already hold, without waiting. */
export const peekInk = (key: string): Ink | undefined => mem.get(key);

/** Bring in what another tab wrote since we last looked, if we hold this answer. */
async function refresh(key: string) {
  const mine = mem.get(key);
  if (!mine) return;
  const r = await attempt<Rec | undefined>("readonly", (s, give) => { const g = s.get(key); g.onsuccess = () => give(g.result as Rec | undefined); });
  if (!r.ok) return;
  const now = mem.get(key) ?? mine;
  const add = strokesToAdd(now, cleanInk(r.value?.ink), seen.get(key));
  if (!add.length) return;
  remember(key, add);
  mem.set(key, [...now, ...add]);
  remote.get(key)?.forEach((cb) => cb(add));
}

/** Keep an answer's ink: at once in memory, then on the device. Returns how many bytes it is. */
export function saveInk(key: string, ink: Ink): Promise<number> {
  mem.set(key, ink);
  remember(key, ink);
  const bytes = inkBytes(ink);
  if (locked.has(key)) return Promise.resolve(bytes);
  type Wrote = { add: Stroke[]; lock: boolean };
  return attempt<Wrote>("readwrite", (s, give) => {
    const g = s.get(key);
    g.onsuccess = () => {
      const rec = g.result as Rec | undefined;
      if (newer(rec)) { give({ add: [], lock: true }); return; }          // a newer app wrote this: leave it alone
      const add = strokesToAdd(ink, cleanInk(rec?.ink), seen.get(key));    // strokes another tab wrote since we last looked
      const all = add.length ? [...ink, ...add] : ink;
      if (all.length === 0) s.delete(key); else s.put({ v: FORMAT, ink: all, at: Date.now() }, key);
      give({ add, lock: false });
    };
  }).then((r) => {
    if (!r.ok || !r.value) return bytes;
    if (r.value.lock) { locked.add(key); return bytes; }
    const add = r.value.add;
    if (add.length) {
      remember(key, add);
      if (mem.get(key) === ink) mem.set(key, [...ink, ...add]);
      remote.get(key)?.forEach((cb) => cb(add));
    }
    try { chan()?.postMessage({ k: key }); } catch { /* the channel closed with the page */ }
    return bytes;
  });
}

/**
 * Copy one answer's handwriting to another key (a question's answer in a paper, to the same question's answer in the feed, or back): only ever on the student's own tap
 * ("Continue here"), never automatically. The strokes are the same strokes (their ids are hashes of their content), so a copy is never mistaken for new writing elsewhere.
 * Returns how many strokes and bytes arrived (0 if there was nothing to copy).
 */
export async function copyInk(from: string, to: string): Promise<{ n: number; bytes: number }> {
  const ink = await loadInk(from);
  if (!ink.length) return { n: 0, bytes: 0 };
  const bytes = await saveInk(to, ink);
  return { n: ink.length, bytes };
}

function forget(key: string) { mem.delete(key); loading.delete(key); seen.delete(key); locked.delete(key); }

export function removeInk(keys: readonly string[]): Promise<void> {
  for (const k of keys) forget(k);
  return attempt("readwrite", (s) => { for (const k of keys) s.delete(k); }).then(() => undefined);
}

/** Every key of a set, for deleting its ink. */
export function removeSetInk(setId: string): Promise<void> {
  for (const k of [...mem.keys(), ...seen.keys(), ...locked]) if (k.startsWith(`${setId}/`)) forget(k);
  return attempt("readwrite", (s) => { s.delete(IDBKeyRange.bound(`${setId}/`, `${setId}/￿`)); }).then(() => undefined);
}

/** Start listening for other tabs (called once a canvas mounts). */
export function watchOtherTabs() { chan(); }
