/**
 * The website's real sync code against the REAL SQL (the app repo's migration 0134), not the stand-in server.
 *
 *   bash tools/sync-check/run.sh      (in the app repo, with SYNC_WEB_REPO set to this checkout; it starts a throwaway Postgres and exports PGHOST/PGPORT)
 *
 * Not part of `npm run sync:test` (it needs a database). Each scenario is one from engine.test.ts, but every call goes through `psql` into the migration's
 * `sync_push` / `sync_pull`, so what is proved is that the web engine and the SQL agree about the wire format, the revisions and every conflict rule.
 * Nothing here touches a real project.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { addCard, addDeck, addTask, deleteCard, deleteDeck, editCard, gradeCard, removeTask, toggleTask } from "../model";
import type { RpcApi } from "./client";
import { Device, type FakeServer } from "./testkit";

const PG = { host: process.env.PGHOST, port: process.env.PGPORT };
const skip = !PG.host || !PG.port;

const psql = (sql: string): string => execFileSync("psql", ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, PGUSER: "postgres", PGDATABASE: "postgres", PGOPTIONS: "-c client_min_messages=warning" } });
const tag = (s: string) => { let t = "q"; while (s.includes(`$${t}$`)) t += "q"; return `$${t}$`; };
const lit = (s: string) => { const t = tag(s); return `${t}${s}${t}`; };

/** A stand-in for the server that is the real SQL. `api(account)` is what the web client calls. */
class SqlServer {
  calls: { name: string; changes?: number }[] = [];
  constructor(readonly user: string, readonly anonymous = false) {}
  api(account?: string): RpcApi {
    void account;
    return {
      rpc: async (name, args) => {
        this.calls.push({ name });
        const claims = JSON.stringify({ sub: this.user, role: "authenticated", is_anonymous: this.anonymous });
        const call = name === "sync_push"
          ? `SELECT public.sync_push(${lit(String(args.p_device))}, ${lit(JSON.stringify(args.p_changes))}::jsonb)::text`
          : `SELECT public.sync_pull(${Number(args.p_since)}, ${Number(args.p_limit)})::text`;
        try {
          const out = psql(`SELECT set_config('request.jwt.claims', ${lit(claims)}, false);\n${call};\n`).trim().split("\n");
          return { data: JSON.parse(out[out.length - 1]), error: null };
        } catch (e) {
          const msg = String((e as { stderr?: string }).stderr ?? e);
          const m = /ERROR:\s+(sync:[a-z_]+)/.exec(msg);
          return { data: null, error: { message: m ? m[1] : msg.slice(0, 200), code: /not_signed_in/.test(msg) ? "42501" : "P0001", status: /not_signed_in/.test(msg) ? 403 : 400 } };
        }
      },
    };
  }
}

const T0 = 1_762_400_000_000;
function setup() {
  const user = randomUUID();
  psql(`INSERT INTO auth.users (id, email, aud, role) VALUES (${lit(user)}, ${lit(`web-${user}@example.invalid`)}, 'authenticated', 'authenticated');`);
  const server = new SqlServer(user);
  const clock = { t: T0 };
  const fake = server as unknown as FakeServer;
  return { user, server, clock, a: new Device(fake, "web-device-a", clock, user), b: new Device(fake, "web-device-b", clock, user) };
}
const count = (sql: string) => Number(psql(sql).trim());
const addDeckTo = (d: Device, title: string, subject: string | null = null): string => { d.act((app, now) => addDeck(app, title, now, subject).data); return d.app.decks.find((x) => x.title === title)!.id; };
const addCardTo = (d: Device, deckId: string, front: string, back = "answer"): string => {
  const before = new Set(d.app.cards.map((c) => c.id));
  d.act((app, now) => addCard(app, deckId, front, back, now));
  return d.app.cards.find((c) => !before.has(c.id))!.id;
};
const texts = (d: Device, deckId: string) => d.cardsIn(deckId).map((c) => c.front).sort();
const card = (d: Device, id: string) => d.app.cards.find((c) => c.id === id);
const done = async (d: Device) => { const o = await d.sync(); assert.equal(o.kind, "done", `${d.name}: ${JSON.stringify(o).slice(0, 200)}`); return o; };

describe("the web sync code against the real SQL", { skip: skip ? "no database (run tools/sync-check/run.sh in the app repo)" : false }, () => {
  it("what one browser makes, a second gets: decks, cards with their schedule, tasks", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "Chemistry notes", "Chemistry");
    const c1 = addCardTo(a, deck, "What is a mole?", "6.02e23");
    addCardTo(a, deck, "Define density");
    a.act((app, now) => gradeCard(app, c1, 3, now));
    a.act((app, now) => addTask(app, "Past paper 1", "2026-11-09", now));
    await done(a); await done(b);
    assert.deepEqual(b.app.decks.map((d) => [d.id, d.title, d.subject, d.starter]), [[deck, "Chemistry notes", "Chemistry", null]]);
    assert.deepEqual(texts(b, deck), ["Define density", "What is a mole?"]);
    assert.deepEqual(card(b, c1)!.sch, card(a, c1)!.sch, "the web's own schedule survives a trip through the real SQL");
    assert.equal(card(b, c1)!.lastReviewed, card(a, c1)!.lastReviewed);
    assert.deepEqual(b.app.tasks.map((t) => [t.text, t.due]), [["Past paper 1", "2026-11-09"]]);
  });

  it("every id the web makes is a valid id for the server (nothing is refused as bad_id)", async () => {
    const { a, user } = setup();
    for (let i = 0; i < 30; i++) addCardTo(a, i === 0 ? addDeckTo(a, "D") : a.app.decks[0].id, `q${i}`);
    for (let i = 0; i < 10; i++) a.act((app, now) => addTask(app, `t${i}`, "2026-11-09", now));
    await done(a);
    assert.equal(count(`SELECT count(*) FROM public.sync_card WHERE user_id = ${lit(user)}`), 30);
    assert.equal(count(`SELECT count(*) FROM public.sync_task WHERE user_id = ${lit(user)}`), 10);
    assert.equal((await a.sync()).kind, "done");
    assert.equal(a.shadow.refused && Object.keys(a.shadow.refused).length, 0, "nothing refused");
  });

  it("a second pass with nothing changed makes no push", async () => {
    const { a, server } = setup();
    addCardTo(a, addDeckTo(a, "D"), "q");
    await done(a);
    const pushes = server.calls.filter((c) => c.name === "sync_push").length;
    await done(a);
    assert.equal(server.calls.filter((c) => c.name === "sync_push").length, pushes);
  });

  it("the same card's words edited on both: both texts survive on both devices, the later one on the card", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "original");
    await done(a); await done(b);
    a.act((app) => editCard(app, id, "from A", "answer"));
    b.act((app) => editCard(app, id, "from B", "answer"));
    await done(a); await done(b); await done(a);
    for (const d of [a, b]) {
      assert.deepEqual(texts(d, deck), ["from A", "from B"], `${d.name} has both`);
      assert.equal(card(d, id)!.front, "from B", "the later edit stays on the card");
    }
    const copy = a.app.cards.find((c) => c.id !== id)!;
    assert.match(copy.id, /^.+~c\d+$/);
    assert.equal(copy.deckId, deck);
  });

  it("a card reviewed on one device and typo-fixed on another: both survive, no copy", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "teh cat");
    await done(a); await done(b);
    a.act((app, now) => gradeCard(app, id, 3, now));
    b.act((app) => editCard(app, id, "the cat", "answer"));
    await done(a); await done(b); await done(a);
    for (const d of [a, b]) {
      assert.equal(card(d, id)!.front, "the cat", `${d.name}: the fix`);
      assert.equal(card(d, id)!.sch.state, "learning", `${d.name}: the review`);
      assert.equal(d.app.cards.length, 1, "no copy");
    }
    assert.deepEqual(card(a, id)!.sch, card(b, id)!.sch);
  });

  it("a deck deleted on one device while a card is reviewed on another: the deck stays deleted", async () => {
    const { a, b, user } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "q");
    await done(a); await done(b);
    a.act((app) => deleteDeck(app, deck));
    b.act((app, now) => gradeCard(app, id, 3, now));
    await done(a); await done(b); await done(a);
    for (const d of [a, b]) { assert.deepEqual(d.app.decks, [], d.name); assert.deepEqual(d.app.cards, [], d.name); }
    assert.equal(count(`SELECT count(*) FROM public.sync_card WHERE user_id = ${lit(user)} AND id = ${lit(id)} AND deleted_at_ms IS NULL`), 1, "the server did not rewrite the card, only the deck is deleted");
  });

  it("a deck deleted on one device and a card in it edited LATER on another: the deck comes back with its other cards", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const keep = addCardTo(a, deck, "edited later");
    addCardTo(a, deck, "left alone");
    await done(a); await done(b);
    a.act((app) => deleteDeck(app, deck));
    await done(a);
    b.act((app) => editCard(app, keep, "edited later!", "answer"));
    await done(b); await done(b); await done(a); await done(a);
    for (const d of [a, b]) {
      assert.equal(d.app.decks.length, 1, `${d.name}: the deck is back`);
      assert.deepEqual(texts(d, deck), ["edited later!", "left alone"], `${d.name}: with all its cards`);
    }
  });

  it("a deleted card is deleted on the other device, and only that card", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const gone = addCardTo(a, deck, "gone");
    addCardTo(a, deck, "stays");
    await done(a); await done(b);
    a.act((app) => deleteCard(app, gone));
    await done(a); await done(b);
    assert.deepEqual(texts(b, deck), ["stays"]);
  });

  it("a task ticked on one device and deleted on another: both end the same", async () => {
    const { a, b } = setup();
    a.act((app, now) => addTask(app, "Read chapter", "2026-11-09", now));
    const id = a.app.tasks[0].id;
    await done(a); await done(b);
    a.act((app, now) => toggleTask(app, id, now));
    b.act((app) => removeTask(app, id));
    await done(a); await done(b); await done(a); await done(b);
    assert.deepEqual(a.app.tasks.map((t) => [t.id, t.done]), b.app.tasks.map((t) => [t.id, t.done]));
  });

  it("first sign-in with local data on both sides: a union, never a replace", async () => {
    const { a, b } = setup();
    const ipadDeck = addDeckTo(a, "iPad deck", "Physics");
    addCardTo(a, ipadDeck, "iPad card");
    a.act((app, now) => addTask(app, "iPad task", "2026-11-10", now));
    await done(a);
    const webDeck = addDeckTo(b, "Web deck", "Chemistry");
    addCardTo(b, webDeck, "web card");
    b.act((app, now) => addTask(app, "web task", "2026-11-11", now));
    await done(b); await done(a);
    for (const d of [a, b]) {
      assert.deepEqual(d.app.decks.map((x) => x.title).sort(), ["Web deck", "iPad deck"], d.name);
      assert.deepEqual(d.app.cards.map((x) => x.front).sort(), ["iPad card", "web card"], d.name);
      assert.deepEqual(d.app.tasks.map((x) => x.text).sort(), ["iPad task", "web task"], d.name);
    }
  });

  it("offline edits go up once online, and a long offline run of changes arrives in order", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    await done(a); await done(b);
    a.online = false;
    for (let i = 0; i < 15; i++) addCardTo(a, deck, `offline ${i}`);
    assert.equal((await a.sync()).kind, "failed");
    a.online = true;
    await done(a); await done(b);
    assert.equal(b.cardsIn(deck).length, 15);
  });

  it("a thousand and more cards go up in pieces and come down in pages", async () => {
    const { a, b, user } = setup();
    const deck = addDeckTo(a, "Big");
    a.act((app, now) => { let d = app; for (let i = 0; i < 1250; i++) d = addCard(d, deck, `front ${i}`, `back ${i}`, now + i); return d; });
    await done(a);
    assert.equal(count(`SELECT count(*) FROM public.sync_card WHERE user_id = ${lit(user)}`), 1250);
    await done(b);
    assert.equal(b.cardsIn(deck).length, 1250);
    assert.deepEqual(a.cardsIn(deck).map((c) => c.front).sort(), b.cardsIn(deck).map((c) => c.front).sort());
  });

  it("one student's data never reaches another's account", async () => {
    const one = setup(), two = setup();
    addCardTo(one.a, addDeckTo(one.a, "Private deck"), "private card");
    await done(one.a); await done(two.a);
    assert.deepEqual(two.a.app.decks, []);
    assert.deepEqual(two.a.app.cards, []);
  });

  it("an anonymous session makes no call (the engine) and the SQL would refuse it anyway", async () => {
    const { user } = setup();
    const anon = new SqlServer(user, true);
    const r = await anon.api(user).rpc("sync_pull", { p_since: 0, p_limit: 10 });
    assert.equal(r.data, null);
    assert.match(r.error!.message, /sync:not_signed_in/);
    assert.equal(r.error!.code, "42501");
  });
});
