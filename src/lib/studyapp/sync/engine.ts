import { deleteDeck, type AppData, type Card, type Deck, type Task } from "../model";
import { SYNC_LIMITS } from "./contract";
import {
  cardContentHash, cardFromWire, cardSchedHash, cardToWire, deckFromWire, deckHash, deckToWire, hasPic, isGeneratedDeck, isGeneratedTitle, scheduleFromWire, taskFromWire,
  taskHash, taskHeldReason, taskToWire, validId, type CardKeep, type ServerCard, type ServerDeck, type ServerTask,
} from "./mapper";
import type { CardChange, Changes, DeckChange, PullPage, PushResponse, Rows, TaskChange } from "./protocol";
import { keyId, keyKind, rowKey, type Noticed, type RowShadow, type Shadow } from "./shadow";

/**
 * The sync engine: pure functions, no network, no storage, no clock of its own (`now` is passed in).
 *
 *   noticeChanges   remember when a change was first seen here, so an edit made offline is pushed with its own time
 *   planPush        what to send (`p_changes`), as a plan with a snapshot of what was sent
 *   applyPush       the server's answer to a push, applied
 *   applyPull       one page of rows from other devices, applied
 *
 * The server (SQL) is the arbiter of every conflict. Nothing here decides who wins: it sends honest base revisions, and applies what comes back.
 * Rules that keep a student's work (each has a test, and each was mutation-tested):
 *  - a row is only ever removed here because the SERVER says it is deleted, never because a pull page did not mention it;
 *  - a row the student changed after a push was snapshotted is not overwritten by that push's answer (it stays changed, and goes next pass);
 *  - a pulled row never overwrites an unsent change (the server settles it when that change is pushed, with the old base revision);
 *  - first sign-in is the same functions with an empty shadow: everything pushes with revision 0, then everything is pulled: a union by id.
 */

const DAY = 86_400_000;
/** A row the server refused for a cap is tried again after this long (the student may have made room), or at once if it changed. */
export const REFUSED_RETRY_MS = DAY;

/** What one pushed row looked like when it was snapshotted: its fingerprints (c content, s schedule, w the whole row) or that it was a deletion. */
export interface Snap { c?: string; s?: string; w?: string; del?: true }
export interface Snapshot { at: number; rows: Record<string, Snap> }
export interface Plan {
  /** The `p_device` argument. */
  device: string;
  /** The `p_changes` argument. */
  changes: Changes;
  snapshot: Snapshot;
  /** The shadow with change times noticed: keep this one. */
  shadow: Shadow;
  /** How many rows are in `changes`. */
  count: number;
  /** A kind had more than the per-push limit: push again after this one. */
  more: boolean;
}

/* ── small helpers ───────────────────────────────────────────────────────────────────────────────────────── */

/** Is a local fingerprint the one the server last confirmed (or the one that was pushed)? Then nothing has changed here since, and the server's version may replace it. */
const same = (cur: string, confirmed: string | undefined, pushed: string | undefined): boolean => cur === confirmed || (pushed !== undefined && cur === pushed);

const isLive = (s: RowShadow | undefined): s is RowShadow => !!s && !s.dead && !s.held;

/* ── Noticing changes ────────────────────────────────────────────────────────────────────────────────────── */

function nextNoticed(n: Noticed | undefined, g: "c" | "s" | "w", hash: string, dirty: boolean, now: number): Noticed | undefined {
  const cur = n?.[g];
  if (!dirty) {
    if (!cur) return n;
    const rest = { ...n }; delete rest[g];
    return Object.keys(rest).length ? rest : undefined;
  }
  if (cur && cur[0] === hash) return n;
  return { ...n, [g]: [hash, now] };
}

/**
 * Record, per row, when a change was first seen here (and when a deletion was). Call it whenever the data changes (cheap), and it is called again
 * by `planPush`. Returns the same shadow object when there is nothing to record.
 */
export function noticeChanges(app: AppData, shadow: Shadow, now: number): Shadow {
  let rows = shadow.rows;
  let copied = false;
  const put = (key: string, next: RowShadow) => { if (!copied) { rows = { ...rows }; copied = true; } rows[key] = next; };
  const withN = (key: string, s: RowShadow, n: Noticed | undefined) => { if (n !== s.n) { const next = { ...s }; if (n) next.n = n; else delete next.n; put(key, next); } };

  const deckIds = new Set<string>(), cardIds = new Set<string>(), taskIds = new Set<string>();
  for (const d of app.decks) {
    deckIds.add(d.id);
    const key = rowKey("deck", d.id), s = rows[key];
    if (!isLive(s) || isGeneratedDeck(d)) continue;
    const h = deckHash(d);
    withN(key, s, nextNoticed(s.n, "w", h, s.h !== h, now));
  }
  for (const c of app.cards) {
    cardIds.add(c.id);
    const key = rowKey("card", c.id), s = rows[key];
    if (!isLive(s) || hasPic(c)) continue;
    const hc = cardContentHash(c, s.keep), hs = cardSchedHash(c);
    let n = nextNoticed(s.n, "c", hc, s.hc !== hc, now);
    n = nextNoticed(n, "s", hs, s.hs !== hs, now);
    withN(key, s, n);
  }
  for (const t of app.tasks) {
    taskIds.add(t.id);
    const key = rowKey("task", t.id), s = rows[key];
    if (!isLive(s)) continue;
    const h = taskHash(t);
    withN(key, s, nextNoticed(s.n, "w", h, s.h !== h, now));
  }
  // deletions: in the shadow, not here
  for (const key of Object.keys(rows)) {
    const s = rows[key];
    if (!isLive(s) || s.tomb) continue;
    const kind = keyKind(key), id = keyId(key);
    const here = kind === "deck" ? deckIds.has(id) : kind === "card" ? cardIds.has(id) : taskIds.has(id);
    if (here) { if (s.n?.x !== undefined) withN(key, s, stripX(s.n)); }
    else if (s.n?.x === undefined) withN(key, s, { ...s.n, x: now });
  }
  return copied ? { ...shadow, rows } : shadow;
}
const stripX = (n: Noticed | undefined): Noticed | undefined => { if (!n) return n; const rest = { ...n }; delete rest.x; return Object.keys(rest).length ? rest : undefined; };

/* ── Planning a push ─────────────────────────────────────────────────────────────────────────────────────── */

export function planPush(app: AppData, shadow0: Shadow, now: number, device: string): Plan {
  const shadow = noticeChanges(app, shadow0, now);
  const rows = shadow.rows;
  const refused = { ...shadow.refused };
  const changes: Changes = { decks: [], cards: [], tasks: [], task_done: [], flags: [] };
  const snapshot: Snapshot = { at: now, rows: {} };
  const cap = SYNC_LIMITS.changesPerKindPerPush;
  let more = false;
  let count = 0;
  const room = (list: unknown[]): boolean => { if (list.length >= cap) { more = true; return false; } return true; };
  const edited = (s: RowShadow | undefined, g: "c" | "s" | "w", hash: string, own: number): number => {
    const n = s?.n?.[g];
    const t = n && n[0] === hash ? n[1] : isLive(s) ? now : own;
    return Math.min(t, now);
  };
  const held = (key: string, sig: string): boolean => { const r = refused[key]; return !!r && r.sig === sig && now - r.at < REFUSED_RETRY_MS; };
  const badId = (key: string, sig: string, id: string): boolean => {
    if (validId(id)) return false;
    refused[key] = { reason: "bad_id", sig, at: now };
    return true;
  };

  const deckById = new Map(app.decks.map((d) => [d.id, d] as const));
  const cardIds = new Set(app.cards.map((c) => c.id));
  const taskIds = new Set(app.tasks.map((t) => t.id));

  /* decks */
  for (const d of app.decks) {
    if (isGeneratedDeck(d)) continue;
    const key = rowKey("deck", d.id), s = rows[key], h = deckHash(d);
    const fresh = !isLive(s);
    if (!fresh && s.h === h) continue;
    if (held(key, h) || badId(key, h, d.id) || !room(changes.decks)) continue;
    const change: DeckChange = { ...deckToWire(d), edited_at_ms: edited(s, "w", h, d.createdAt), base_content_rev: fresh ? 0 : (s.crev ?? 0) };
    changes.decks.push(change);
    snapshot.rows[key] = { w: h };
  }

  /* cards */
  const position = new Map<string, number>();
  const perDeck = new Map<string, number>();
  for (const c of app.cards) { const p = perDeck.get(c.deckId) ?? 0; position.set(c.id, p); perDeck.set(c.deckId, p + 1); }
  for (const c of app.cards) {
    if (hasPic(c)) continue;
    const deck = deckById.get(c.deckId);
    if (!deck || isGeneratedDeck(deck)) continue;
    const key = rowKey("card", c.id), s = rows[key];
    const hc = cardContentHash(c, s?.keep), hs = cardSchedHash(c);
    const fresh = !isLive(s);
    const cDirty = fresh || s.hc !== hc, sDirty = fresh || s.hs !== hs;
    if (!cDirty && !sDirty) continue;
    const sig = `${hc}|${hs}`;
    if (held(key, sig) || badId(key, sig, c.id)) continue;
    if (refused[rowKey("deck", c.deckId)] && !isLive(rows[rowKey("deck", c.deckId)])) continue;   // its deck is not backed up, so neither is it
    if (!room(changes.cards)) continue;
    const wire = cardToWire(c, s?.keep?.position ?? position.get(c.id) ?? 0, fresh ? undefined : s.keep);
    const change: CardChange = { id: c.id, deck_id: c.deckId, created_at_ms: c.createdAt, base_rev: fresh ? 0 : s.rev };
    const snap: Snap = { c: hc, s: hs };   // both fingerprints, so an answer can tell "unchanged since the push" for either group
    if (cDirty) {
      change.content = wire.content;
      change.content_at_ms = edited(s, "c", hc, c.createdAt);
      change.base_content_rev = fresh ? 0 : (s.crev ?? 0);
    }
    if (sDirty) {
      change.sched = wire.sched;
      change.sched_at_ms = Math.min(c.lastReviewed ?? edited(s, "s", hs, c.createdAt), now);
      change.base_sched_rev = fresh ? 0 : (s.srev ?? 0);
    }
    changes.cards.push(change);
    snapshot.rows[key] = snap;
  }

  /* tasks */
  app.tasks.forEach((t, index) => {
    const key = rowKey("task", t.id), s = rows[key], h = taskHash(t);
    const fresh = !isLive(s);
    if (!fresh && s.h === h) return;
    if (held(key, h) || badId(key, h, t.id) || !room(changes.tasks)) return;
    const w = taskToWire(t, { filedAt: fresh ? null : s.keep?.filedAt, sortOrder: fresh ? index : (s.keep?.sortOrder ?? 0) });
    const change: TaskChange = { ...w, edited_at_ms: edited(s, "w", h, Math.max(t.createdAt, t.doneAt ?? 0)), base_rev: fresh ? 0 : s.rev };
    changes.tasks.push(change);
    snapshot.rows[key] = { w: h };
  });

  /* deletions: in the shadow, gone here. A card whose deck is gone too is hidden with it (the deck's deletion covers it; the server does not rewrite its cards). */
  for (const key of Object.keys(rows)) {
    const s = rows[key];
    if (!isLive(s) || s.tomb) continue;
    const kind = keyKind(key), id = keyId(key);
    const at = Math.min(s.n?.x ?? now, now);
    if (kind === "deck") {
      if (deckById.has(id) || !room(changes.decks)) continue;
      changes.decks.push({ id, edited_at_ms: at, deleted_at_ms: at, base_content_rev: s.crev ?? 0 });
    } else if (kind === "card") {
      if (cardIds.has(id) || (s.d !== undefined && !deckById.has(s.d)) || !room(changes.cards)) continue;
      changes.cards.push({ id, deck_id: s.d ?? "", created_at_ms: s.ca ?? 0, deleted_at_ms: at, base_rev: s.rev });
    } else {
      if (taskIds.has(id) || !room(changes.tasks)) continue;
      changes.tasks.push({ id, edited_at_ms: at, created_at_ms: s.ca ?? 0, deleted_at_ms: at, base_rev: s.rev });
    }
    snapshot.rows[key] = { del: true };
  }

  count = changes.decks.length + changes.cards.length + changes.tasks.length;
  const sameRefused = Object.keys(refused).length === Object.keys(shadow.refused).length && Object.keys(refused).every((k) => shadow.refused[k]?.at === refused[k].at);
  return { device, changes, snapshot, shadow: sameRefused ? shadow : pruneRefused(app, { ...shadow, refused }), count, more };
}

/* ── Applying what the server says ───────────────────────────────────────────────────────────────────────── */

interface Merged { app: AppData; shadow: Shadow }

/**
 * Apply server rows (a push's answer, or a pull page) to the app's data and the shadow. `snap` is the snapshot of the push these rows answer, or null
 * for a pull. For each group of a row: if the server's version is already what is here, only the shadow moves; if what is here is unchanged since the
 * server last confirmed it (or since the push was snapshotted), the server's version replaces it; otherwise the student has changed it since, so it is left
 * alone (and the shadow keeps its old base revision, so the server will see a stale write and keep both versions).
 */
function merge(app: AppData, shadow: Shadow, rows: Rows, snap: Snapshot | null): Merged {
  const decks = new Map(app.decks.map((d) => [d.id, d] as const));
  const cards = new Map(app.cards.map((c) => [c.id, c] as const));
  const tasks = new Map(app.tasks.map((t) => [t.id, t] as const));
  const R: Record<string, RowShadow> = { ...shadow.rows };
  let repull = shadow.repull === true;
  const removedDecks: string[] = [];
  let changed = false;
  const snapOf = (key: string): Snap | undefined => snap?.rows[key];

  const cardsOf = (deckId: string): Card[] => [...cards.values()].filter((c) => c.deckId === deckId);
  /** Is this card's work all up? (A picture card has no shadow and is never "up": it only lives here.) */
  const cardInSync = (c: Card): boolean => {
    if (hasPic(c)) return false;
    const key = rowKey("card", c.id), s = R[key], sn = snapOf(key);
    return isLive(s) && same(cardContentHash(c, s.keep), s.hc, sn?.c) && same(cardSchedHash(c), s.hs, sn?.s);
  };
  const hideCardsOf = (deckId: string) => {
    for (const key of Object.keys(R)) {
      const s = R[key];
      if (keyKind(key) === "card" && s.d === deckId && !cards.has(keyId(key)) && !s.dead) R[key] = { rev: s.rev, dead: true, d: deckId };
    }
  };
  const removeDeckHere = (id: string, srvRev: number) => {
    for (const c of cardsOf(id)) { cards.delete(c.id); const k = rowKey("card", c.id); if (R[k]) R[k] = { rev: R[k].rev, dead: true, d: id }; }
    decks.delete(id);
    hideCardsOf(id);
    removedDecks.push(id);
    R[rowKey("deck", id)] = { rev: srvRev, dead: true };
    changed = true;
  };

  /* decks */
  const applyDeck = (srv: ServerDeck) => {
    const key = rowKey("deck", srv.id), s = R[key], sn = snapOf(key), local = decks.get(srv.id);
    if (srv.deletedAt === null && isGeneratedTitle(srv.title)) {
      // Plumi's own content is remade on each device: never taken from a pull, never written back.
      if (!local && !s) R[key] = { rev: srv.rev, dead: true };
      return;
    }
    if (srv.deletedAt !== null) {
      if (!local) { if (isLive(s)) hideCardsOf(srv.id); R[key] = { rev: srv.rev, dead: true }; return; }
      if (!same(deckHash(local), s?.h, sn?.w)) return;
      if (cardsOf(srv.id).some((c) => !cardInSync(c))) { R[key] = { ...(s ?? { rev: srv.rev, h: deckHash(local) }), tomb: true }; return; }
      removeDeckHere(srv.id, srv.rev);
      return;
    }
    if (s?.dead) repull = true;   // a deleted deck is back (a card in it was edited elsewhere): read everything again once so its cards come back too
    const live = isLive(s) ? s : undefined;
    const incoming = deckFromWire(srv);
    const rowNow = (h: string): RowShadow => { const r: RowShadow = { ...live, rev: srv.rev, crev: srv.contentRev, h }; delete r.tomb; delete r.dead; delete r.held; return r; };
    if (!local) {
      if (live && !sn?.del) return;   // deleted here and not pushed yet: stays deleted
      decks.set(incoming.id, incoming);
      R[key] = rowNow(deckHash(incoming));
      newDecks.add(incoming.id);
      changed = true;
      return;
    }
    const lh = deckHash(local), ih = deckHash(incoming);
    if (ih === lh) { R[key] = rowNow(lh); return; }
    if (same(lh, live?.h, sn?.w)) {
      decks.set(srv.id, { ...local, title: incoming.title, subject: incoming.subject });
      R[key] = rowNow(ih);
      changed = true;
      return;
    }
    if (sn?.w !== undefined && ih === sn.w) R[key] = rowNow(ih);   // the server took what was pushed; this row has been changed again since
  };
  const newDecks = new Set<string>();

  /* cards */
  const applyCard = (srv: ServerCard) => {
    const key = rowKey("card", srv.id), s = R[key], sn = snapOf(key), local = cards.get(srv.id);
    if (srv.deletedAt !== null) {
      if (!local) { if (s && !s.dead) R[key] = { rev: srv.rev, dead: true, d: s.d ?? srv.deckId }; return; }
      if (hasPic(local) || !isLive(s)) return;
      if (!same(cardContentHash(local, s.keep), s.hc, sn?.c) || !same(cardSchedHash(local), s.hs, sn?.s)) return;
      cards.delete(srv.id);
      R[key] = { rev: srv.rev, dead: true, d: srv.deckId };
      changed = true;
      return;
    }
    const dKey = rowKey("deck", srv.deckId), dRow = R[dKey], dLocal = decks.get(srv.deckId);
    if (!dLocal) {
      // The deck is hidden or deleted here (do not bring the card back on its own), or it has not arrived yet (keep the row until it does).
      if (dRow && !dRow.held) return;
      R[key] = { rev: srv.rev, crev: srv.contentRev, srev: srv.schedRev, d: srv.deckId, ca: srv.createdAt, held: srv };
      return;
    }
    if (isGeneratedDeck(dLocal)) return;
    const live = isLive(s) ? s : undefined;
    if (!local) {
      if (live && !sn?.del) return;   // deleted here and not pushed yet: stays deleted
      const { card, keep } = cardFromWire(srv);
      cards.set(card.id, card);
      R[key] = { rev: srv.rev, crev: srv.contentRev, srev: srv.schedRev, hc: cardContentHash(card, keep), hs: cardSchedHash(card), d: srv.deckId, ca: srv.createdAt, keep };
      changed = true;
      return;
    }
    if (hasPic(local)) return;
    const next: RowShadow = { ...(live ?? { rev: 0 }), d: srv.deckId, ca: srv.createdAt };
    delete next.dead; delete next.held;
    const keep: CardKeep = { ...next.keep };
    let updated: Card = local;
    let everything = true, any = false;

    const lc = cardContentHash(local, live?.keep);
    const ic = cardContentHash({ ...local, deckId: srv.deckId, front: srv.front, back: srv.back }, { frontImage: srv.frontImage, backImage: srv.backImage });
    const takeContent = () => { keep.frontImage = srv.frontImage; keep.backImage = srv.backImage; keep.position = srv.position; next.crev = srv.contentRev; any = true; };
    if (ic === lc) { next.hc = lc; takeContent(); }
    else if (same(lc, live?.hc, sn?.c)) { updated = { ...updated, deckId: srv.deckId, front: srv.front, back: srv.back }; next.hc = ic; takeContent(); }
    else if (sn?.c !== undefined && ic === sn.c) { next.hc = ic; takeContent(); }
    else everything = false;

    const srvSch = scheduleFromWire(srv.sched, srv.sched.core.last_reviewed_ms);
    const srvLast = srv.sched.core.last_reviewed_ms;
    const ls = cardSchedHash(local);
    const is = cardSchedHash({ ...local, sch: srvSch, lastReviewed: srvLast });
    const { web: _w, ...others } = (srv.sched.extra ?? {}) as Record<string, unknown>; void _w;
    const takeSched = () => { keep.extra = others; next.srev = srv.schedRev; any = true; };
    if (is === ls) { next.hs = ls; takeSched(); }
    else if (same(ls, live?.hs, sn?.s)) { updated = { ...updated, sch: srvSch, lastReviewed: srvLast }; next.hs = is; takeSched(); }
    else if (sn?.s !== undefined && is === sn.s) { next.hs = is; takeSched(); }
    else everything = false;

    if (!any) return;
    next.keep = keep;
    if (everything) next.rev = srv.rev;
    R[key] = next;
    if (updated !== local) { cards.set(srv.id, updated); changed = true; }
  };

  /* tasks */
  const applyTask = (srv: ServerTask) => {
    const key = rowKey("task", srv.id), s = R[key], sn = snapOf(key), local = tasks.get(srv.id);
    if (srv.deletedAt !== null) {
      if (!local) { if (s?.held) delete R[key]; else if (s && !s.dead) R[key] = { rev: srv.rev, dead: true }; return; }
      if (!same(taskHash(local), s?.h, sn?.w)) return;
      tasks.delete(srv.id);
      R[key] = { rev: srv.rev, dead: true };
      changed = true;
      return;
    }
    const live = isLive(s) ? s : undefined;
    if (taskHeldReason(srv) !== null) {
      // Repeating, hand-written or undated: the iPad's kind of task. Kept as it came and never shown here as an ordinary task.
      if (local) { if (!same(taskHash(local), live?.h, sn?.w)) return; tasks.delete(srv.id); changed = true; }
      else if (live && !sn?.del) return;
      R[key] = { rev: srv.rev, ca: srv.createdAt, held: srv };
      return;
    }
    const parsed = taskFromWire(srv)!;
    const rowNow = (h: string): RowShadow => ({ rev: srv.rev, ca: srv.createdAt, h, keep: parsed.keep });
    if (!local) {
      if (live && !sn?.del) return;
      tasks.set(srv.id, parsed.task);
      R[key] = rowNow(taskHash(parsed.task));
      changed = true;
      return;
    }
    const lh = taskHash(local), ih = taskHash(parsed.task);
    if (ih === lh) { R[key] = rowNow(lh); return; }
    if (same(lh, live?.h, sn?.w)) {
      tasks.set(srv.id, { ...local, text: parsed.task.text, subject: parsed.task.subject, due: parsed.task.due, done: parsed.task.done, doneAt: parsed.task.doneAt });
      R[key] = rowNow(ih);
      changed = true;
      return;
    }
    if (sn?.w !== undefined && ih === sn.w) R[key] = rowNow(ih);
  };

  rows.decks.forEach(applyDeck);
  // cards that were waiting for a deck that has now arrived
  if (newDecks.size) {
    for (const key of Object.keys(R)) {
      const s = R[key];
      if (s.held && keyKind(key) === "card" && s.d !== undefined && newDecks.has(s.d)) applyCard(s.held as ServerCard);
    }
  }
  rows.cards.forEach(applyCard);
  rows.tasks.forEach(applyTask);

  // a deck the server deleted that was kept for unsent work: now that the work is up, let it go
  for (const key of Object.keys(R)) {
    const s = R[key];
    if (!s.tomb || keyKind(key) !== "deck") continue;
    const id = keyId(key), deck = decks.get(id);
    if (!deck) { R[key] = { rev: s.rev, dead: true }; continue; }
    if (cardsOf(id).every(cardInSync)) removeDeckHere(id, s.rev);
  }

  let out = app;
  if (changed) {
    out = { ...app, decks: [...decks.values()], cards: [...cards.values()], tasks: [...tasks.values()] };
    for (const id of removedDecks) out = deleteDeck(out, id);   // also takes it out of saved sessions
  }
  return { app: out, shadow: { ...shadow, rows: R, repull: repull || undefined } };
}

/**
 * One page of rows from other devices. Never deletes anything for being absent: only a row the server marks deleted is removed here, and only if it is
 * unchanged here. The cursor moves forward only. When the last page has been read and a deleted deck came back, the cursor goes back to 0 once (`restart`).
 */
export function applyPull(app: AppData, shadow: Shadow, page: PullPage): Merged & { restart: boolean } {
  const m = merge(app, shadow, page, null);
  let next: Shadow = { ...m.shadow, cursor: Math.max(shadow.cursor, page.next) };
  let restart = false;
  if (!page.more && next.repull) { next = { ...next, cursor: 0, repull: undefined }; restart = true; }
  return { app: m.app, shadow: next, restart };
}

/**
 * The server's answer to a push, applied. `snapshot` is what `planPush` said it sent: a row the student has changed since is not overwritten.
 * Refused rows (a safety cap) are remembered as "not backed up", calmly; a row the server has no record of is sent as a new one next time.
 */
export function applyPush(app: AppData, shadow: Shadow, resp: PushResponse, snapshot: Snapshot): Merged & { progressed: boolean } {
  const m = merge(app, shadow, resp.rows, snapshot);
  const rows = { ...m.shadow.rows };
  const refused = { ...m.shadow.refused };
  for (const r of resp.refused) {
    const key = rowKey(r.kind, r.id);
    if (r.reason === "no_row") { delete rows[key]; delete refused[key]; continue; }
    const sn = snapshot.rows[key];
    refused[key] = { reason: r.reason, sig: r.kind === "card" ? `${sn?.c ?? ""}|${sn?.s ?? ""}` : (sn?.w ?? ""), at: snapshot.at };
  }
  const answered = [...resp.rows.decks.map((d) => rowKey("deck", d.id)), ...resp.rows.cards.map((c) => rowKey("card", c.id)), ...resp.rows.tasks.map((t) => rowKey("task", t.id))];
  for (const key of answered) delete refused[key];
  const progressed = answered.length > 0 || resp.refused.length > 0;
  return { app: m.app, shadow: pruneRefused(m.app, { ...m.shadow, rows, refused }), progressed };
}

/** Rows the server refused for a cap and that are still not backed up (shown as one calm note). */
export const refusedCount = (shadow: Shadow): number => Object.keys(shadow.refused).length;

/** Drop what the shadow remembers about rows that no longer exist anywhere (a refused row the student then deleted). */
export function pruneRefused(app: AppData, shadow: Shadow): Shadow {
  const keys = Object.keys(shadow.refused);
  if (!keys.length) return shadow;
  const here = new Set<string>([...app.decks.map((d) => rowKey("deck", d.id)), ...app.cards.map((c) => rowKey("card", c.id)), ...app.tasks.map((t) => rowKey("task", t.id))]);
  const kept = Object.fromEntries(Object.entries(shadow.refused).filter(([k]) => here.has(k)));
  return Object.keys(kept).length === keys.length ? shadow : { ...shadow, refused: kept };
}

export type { Deck, Task };
