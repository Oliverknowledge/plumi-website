/**
 * FOR TESTS ONLY (nothing in the app imports this file).
 *
 * A small in-memory stand-in for the server, and a "device" that syncs against it. The stand-in implements the design's conflict rules
 * (sync-design.md section 4) just well enough to test the website's side. The real arbiter is the SQL migration (0134_syncDecks.sql in the iPad
 * repo), which nobody here has run: these tests prove the website sends honest base revisions and applies what comes back, NOT that the
 * server's rules are right.
 */
import { EMPTY, type AppData } from "../model";
import { createSyncClient, type RpcApi } from "./client";
import { runPass, type Outcome } from "./runner";
import { emptyShadow, type Shadow } from "./shadow";

type J = Record<string, unknown>;
interface SDeck { id: string; title: string; subject: string | null; created_at_ms: number; rev: number; content_rev: number; content_at: number; content_dev: string; deleted_at: number | null; device: string }
interface SCard {
  id: string; deck_id: string; created_at_ms: number; content: J; content_at: number; content_dev: string; content_rev: number;
  sched: J; sched_at: number; sched_dev: string; sched_rev: number; rev: number; deleted_at: number | null; device: string; conflict_of: string | null;
}
interface STask { id: string; row: J; edited_at: number; dev: string; rev: number; deleted_at: number | null; device: string }

const later = (a: [number, string], b: [number, string]) => (a[0] !== b[0] ? a[0] - b[0] : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export class FakeServer {
  rev = 0;
  decks = new Map<string, SDeck>();
  cards = new Map<string, SCard>();
  tasks = new Map<string, STask>();
  caps: { decks?: number; cards?: number; tasks?: number } = {};
  calls: { name: string; args: J }[] = [];
  /** When set, every call fails with this error. */
  down: { message: string; code?: string; status?: number } | null = null;
  /** When set, the next answer to push is replaced by this (a shape nobody expected, say). */
  oddPush: unknown = undefined;
  pushes: J[] = [];
  /** Run once, right after a push has been applied here and before its answer goes back (a student acting while the request is in flight). */
  duringPush: (() => void) | null = null;

  private bump() { return ++this.rev; }
  private live<T extends { deleted_at: number | null }>(m: Map<string, T>) { return [...m.values()].filter((r) => r.deleted_at === null).length; }

  push(device: string, changes: J): J {
    this.pushes.push(changes);
    const touched = { decks: new Set<string>(), cards: new Set<string>(), tasks: new Set<string>() };
    const conflicts: J[] = [], refused: J[] = [];
    let applied = 0;
    const now = 4_000_000_000_000;

    for (const d of (changes.decks as J[]) ?? []) {
      const id = d.id as string, row = this.decks.get(id);
      if (d.deleted_at_ms !== undefined) {
        if (!row) { refused.push({ kind: "deck", id, reason: "no_row" }); continue; }
        touched.decks.add(id);
        if (row.content_at > (d.deleted_at_ms as number)) continue;
        row.deleted_at = d.deleted_at_ms as number; row.rev = this.bump(); applied++;
        continue;
      }
      if (!row) {
        if (this.caps.decks !== undefined && this.live(this.decks) >= this.caps.decks) { refused.push({ kind: "deck", id, reason: "quota" }); continue; }
        const rev = this.bump();
        this.decks.set(id, { id, title: d.title as string, subject: d.subject as string | null, created_at_ms: d.created_at_ms as number, rev, content_rev: rev, content_at: d.edited_at_ms as number, content_dev: device, deleted_at: null, device });
        touched.decks.add(id); applied++;
        continue;
      }
      touched.decks.add(id);
      const at = Math.min(d.edited_at_ms as number, now);
      if (row.deleted_at !== null) { if (at > row.deleted_at) row.deleted_at = null; else continue; }
      if (row.title !== d.title || row.subject !== d.subject) {
        if (later([at, device], [row.content_at, row.content_dev]) >= 0) { row.title = d.title as string; row.subject = d.subject as string | null; row.content_at = at; row.content_dev = device; }
        row.content_rev = this.bump();
      }
      row.rev = this.bump(); row.device = device; applied++;
    }

    for (const c of (changes.cards as J[]) ?? []) {
      const id = c.id as string, row = this.cards.get(id);
      if (c.deleted_at_ms !== undefined) {
        if (!row) { refused.push({ kind: "card", id, reason: "no_row" }); continue; }
        touched.cards.add(id);
        if (row.content_at > (c.deleted_at_ms as number)) continue;
        row.deleted_at = c.deleted_at_ms as number; row.rev = this.bump(); applied++;
        continue;
      }
      if (!row) {
        // an edit of a row this server has never had: "no_row" (the client sends it again as a new one); a new row needs both groups
        if ((c.base_rev as number) > 0 || !c.content || !c.sched) { refused.push({ kind: "card", id, reason: (c.base_rev as number) > 0 ? "no_row" : "bad_row" }); continue; }
        if (this.caps.cards !== undefined && this.live(this.cards) >= this.caps.cards) { refused.push({ kind: "card", id, reason: "quota" }); continue; }
        const rev = this.bump();
        this.cards.set(id, {
          id, deck_id: c.deck_id as string, created_at_ms: c.created_at_ms as number, content: c.content as J, content_at: c.content_at_ms as number, content_dev: device, content_rev: rev,
          sched: c.sched as J, sched_at: c.sched_at_ms as number, sched_dev: device, sched_rev: rev, rev, deleted_at: null, device, conflict_of: null,
        });
        touched.cards.add(id); applied++;
        continue;
      }
      touched.cards.add(id);
      if (c.content) {
        const at = Math.min(c.content_at_ms as number, now);
        const deck = this.decks.get(row.deck_id);
        if (deck && deck.deleted_at !== null && at > deck.deleted_at) { deck.deleted_at = null; deck.rev = this.bump(); touched.decks.add(deck.id); }
        if (row.deleted_at !== null) {
          if (at > row.deleted_at) { row.deleted_at = null; row.content = c.content as J; row.content_at = at; row.content_dev = device; row.content_rev = this.bump(); }
        } else if (!eq(row.content, c.content)) {
          if (((c.base_content_rev as number) ?? 0) < row.content_rev) {
            const incomingLater = later([at, device], [row.content_at, row.content_dev]) > 0;
            const rev = this.bump();
            const copyId = `${id}~c${rev}`;
            this.cards.set(copyId, {
              id: copyId, deck_id: row.deck_id, created_at_ms: row.created_at_ms, content: incomingLater ? row.content : (c.content as J), content_at: incomingLater ? row.content_at : at, content_dev: device,
              content_rev: rev, sched: row.sched, sched_at: row.sched_at, sched_dev: row.sched_dev, sched_rev: rev, rev, deleted_at: null, device, conflict_of: id,
            });
            conflicts.push({ kind: "card", id, copy_id: copyId });
            touched.cards.add(copyId);
            if (incomingLater) { row.content = c.content as J; row.content_at = at; row.content_dev = device; }
          } else { row.content = c.content as J; row.content_at = at; row.content_dev = device; }
          row.content_rev = this.bump();
        }
      }
      if (c.sched && row.deleted_at === null) {
        const at = Math.min(c.sched_at_ms as number, now);
        if (later([at, device], [row.sched_at, row.sched_dev]) >= 0 && !eq(row.sched, c.sched)) { row.sched = c.sched as J; row.sched_at = at; row.sched_dev = device; row.sched_rev = this.bump(); }
      }
      row.rev = this.bump(); row.device = device; applied++;
    }

    for (const t of (changes.tasks as J[]) ?? []) {
      const id = t.id as string, row = this.tasks.get(id);
      if (t.deleted_at_ms !== undefined) {
        if (!row) { refused.push({ kind: "task", id, reason: "no_row" }); continue; }
        touched.tasks.add(id);
        if (row.edited_at > (t.deleted_at_ms as number)) continue;
        row.deleted_at = t.deleted_at_ms as number; row.rev = this.bump(); applied++;
        continue;
      }
      if (!row) {
        if (this.caps.tasks !== undefined && this.live(this.tasks) >= this.caps.tasks) { refused.push({ kind: "task", id, reason: "quota" }); continue; }
        this.tasks.set(id, { id, row: t, edited_at: t.edited_at_ms as number, dev: device, rev: this.bump(), deleted_at: null, device });
        touched.tasks.add(id); applied++;
        continue;
      }
      touched.tasks.add(id);
      const at = Math.min(t.edited_at_ms as number, now);
      if (later([at, device], [row.edited_at, row.dev]) >= 0) { row.row = t; row.edited_at = at; row.dev = device; row.deleted_at = null; row.rev = this.bump(); applied++; }
    }

    this.duringPush?.();
    return {
      rev: this.rev, applied, conflicts, refused,
      rows: {
        decks: [...touched.decks].map((id) => this.deckRow(this.decks.get(id)!)),
        cards: [...touched.cards].map((id) => this.cardRow(this.cards.get(id)!)),
        tasks: [...touched.tasks].map((id) => this.taskRow(this.tasks.get(id)!)),
        task_done: [], flags: [],
      },
    };
  }

  private deckRow(d: SDeck): J {
    return { id: d.id, title: d.title, subject: d.subject, origin: "own", created_at_ms: d.created_at_ms, edited_at_ms: d.content_at, rev: d.rev, content_rev: d.content_rev, device_id: d.device, deleted_at_ms: d.deleted_at };
  }
  private cardRow(c: SCard): J {
    return {
      id: c.id, deck_id: c.deck_id, created_at_ms: c.created_at_ms, content: c.content, content_at_ms: c.content_at, sched: c.sched, sched_at_ms: c.sched_at,
      rev: c.rev, content_rev: c.content_rev, sched_rev: c.sched_rev, device_id: c.device, conflict_of: c.conflict_of, deleted_at_ms: c.deleted_at,
    };
  }
  private taskRow(t: STask): J { return { ...t.row, base_rev: undefined, rev: t.rev, device_id: t.device, deleted_at_ms: t.deleted_at }; }

  pull(since: number, limit: number): J {
    const all: { rev: number; kind: "decks" | "cards" | "tasks"; row: J }[] = [];
    for (const d of this.decks.values()) if (d.rev > since) all.push({ rev: d.rev, kind: "decks", row: this.deckRow(d) });
    for (const c of this.cards.values()) if (c.rev > since) all.push({ rev: c.rev, kind: "cards", row: this.cardRow(c) });
    for (const t of this.tasks.values()) if (t.rev > since) all.push({ rev: t.rev, kind: "tasks", row: this.taskRow(t) });
    all.sort((a, b) => a.rev - b.rev);
    const page = all.slice(0, limit);
    const out: J = { rev: this.rev, next: page.length ? page[page.length - 1].rev : since, more: all.length > page.length, decks: [], cards: [], tasks: [], task_done: [], flags: [] };
    for (const p of page) (out[p.kind] as J[]).push(p.row);
    return out;
  }

  /** The rpc as the website's client calls it. `user` is who is signed in (null: not signed in). */
  api(user: string | null = "user-1"): RpcApi & { calls: FakeServer["calls"] } {
    return {
      calls: this.calls,
      rpc: async (name, args) => {
        this.calls.push({ name, args });
        if (this.down) return { data: null, error: this.down };
        if (!user) return { data: null, error: { message: "sync:not_signed_in", code: "42501", status: 403 } };
        if (name === "sync_push") {
          const r = this.push(args.p_device as string, args.p_changes as J);
          if (this.oddPush !== undefined) { const odd = this.oddPush; this.oddPush = undefined; return { data: odd, error: null }; }
          return { data: JSON.parse(JSON.stringify(r)), error: null };
        }
        if (name === "sync_pull") return { data: JSON.parse(JSON.stringify(this.pull(args.p_since as number, args.p_limit as number))), error: null };
        return { data: null, error: { message: "could not find the function", code: "PGRST202", status: 404 } };
      },
    };
  }
}

/** One browser: its app data, its shadow, and a way to sync against the fake server. */
export class Device {
  app: AppData = EMPTY;
  shadow: Shadow;
  online = true;
  constructor(readonly server: FakeServer, readonly name: string, readonly clock: { t: number }, readonly account = "user-1") {
    this.shadow = emptyShadow(account);
  }
  /** A student action: `fn` gets the data and returns the new data; time moves on one second first. */
  act(fn: (d: AppData, now: number) => AppData): void { this.clock.t += 1000; this.app = fn(this.app, this.clock.t); }
  async sync(): Promise<Outcome> {
    this.clock.t += 1000;
    const client = createSyncClient(this.server.api(this.account));
    const out = await runPass({
      client, account: { id: this.account }, device: this.name, now: () => this.clock.t, online: () => this.online,
      getApp: () => this.app, update: (fn) => { this.app = fn(this.app); }, save: (s) => { this.shadow = s; }, current: () => true,
    }, this.shadow);
    if (out.kind !== "skipped") this.shadow = out.shadow;
    return out;
  }
  cardsIn(deckId: string) { return this.app.cards.filter((c) => c.deckId === deckId); }
}
