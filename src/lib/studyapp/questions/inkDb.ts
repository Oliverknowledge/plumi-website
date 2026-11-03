"use client";

import { cleanInk, inkBytes, type Ink } from "./ink";

/**
 * Where handwriting is kept: IndexedDB (`plumi-study-ink`, one object store `ink`, key `<setId>/<partId>`, value
 * `{ v: 1, ink: Stroke[], at }`). Not localStorage: that is about 5 MB for the whole origin and the app's other data
 * (tasks, cards, answers' text) shares it; a page of working is tens of kilobytes and a set of twelve parts can reach
 * a few megabytes. The app's document keeps only how many strokes and bytes each answer has (questions/model.ts).
 *
 * Everything works without it. If IndexedDB is missing or refuses (a private window in an older browser, blocked site
 * data), ink is kept in memory for the visit and `inkDbOk()` says it is not being saved, so the sheet can say so. A
 * student never sees an error from here.
 *
 * Safari note: WebKit deletes a site's script-written data (localStorage, IndexedDB) after seven days without a visit
 * unless the site is added to the Home Screen. It applies to all of this app's data, not only ink (docs/study/questions.md).
 */
const DB = "plumi-study-ink";
const STORE = "ink";

const mem = new Map<string, Ink>();
const loading = new Map<string, Promise<Ink>>();
let dbp: Promise<IDBDatabase | null> | null = null;
let ok: boolean | null = null;
const listeners = new Set<() => void>();
const setOk = (v: boolean) => { if (ok !== v) { ok = v; listeners.forEach((l) => l()); } };

/** Is ink being kept on this device? null until we know. */
export const inkDbOk = () => ok;
export function onInkDbChange(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

function open(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") { setOk(false); return resolve(null); }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => { setOk(true); resolve(req.result); };
      req.onerror = () => { setOk(false); resolve(null); };
      req.onblocked = () => { setOk(false); resolve(null); };
    } catch { setOk(false); resolve(null); }
  });
  return dbp;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((resolve) => {
    if (!db) return resolve(undefined);
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
      tx.onerror = () => { setOk(false); resolve(undefined); };
      tx.onabort = () => { setOk(false); resolve(undefined); };
    } catch { setOk(false); resolve(undefined); }
  }));
}

/** An answer's ink: from memory if it has been seen this visit, else from the device. Always resolves (empty if there is none). */
export function loadInk(key: string): Promise<Ink> {
  const hit = mem.get(key);
  if (hit) return Promise.resolve(hit);
  let p = loading.get(key);
  if (!p) {
    p = run<{ ink?: unknown }>("readonly", (s) => s.get(key)).then((rec) => {
      // A stroke drawn while this was loading wins over what was stored.
      const ink = mem.get(key) ?? cleanInk(rec?.ink);
      mem.set(key, ink);
      loading.delete(key);
      return ink;
    });
    loading.set(key, p);
  }
  return p;
}

/** The ink we already hold, without waiting. */
export const peekInk = (key: string): Ink | undefined => mem.get(key);

/** Keep an answer's ink: at once in memory, then on the device. Returns how many bytes it is. */
export function saveInk(key: string, ink: Ink): Promise<number> {
  mem.set(key, ink);
  const bytes = inkBytes(ink);
  if (ink.length === 0) return run("readwrite", (s) => { s.delete(key); }).then(() => 0);
  return run("readwrite", (s) => s.put({ v: 1, ink, at: Date.now() }, key)).then(() => bytes);
}

export function removeInk(keys: readonly string[]): Promise<void> {
  for (const k of keys) { mem.delete(k); loading.delete(k); }
  return run("readwrite", (s) => { for (const k of keys) s.delete(k); }).then(() => undefined);
}

/** Every key of a set, for deleting its ink. */
export function removeSetInk(setId: string): Promise<void> {
  for (const k of [...mem.keys()]) if (k.startsWith(`${setId}/`)) mem.delete(k);
  return run("readwrite", (s) => { s.delete(IDBKeyRange.bound(`${setId}/`, `${setId}/￿`)); }).then(() => undefined);
}
