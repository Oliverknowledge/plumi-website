/**
 * npm run sync:test
 *
 * The engine against a stand-in server (testkit.ts). The stand-in implements the design's rules for these tests only: the real arbiter of every
 * conflict is the SQL, which these tests do not touch. What they prove is the website's half: honest base revisions out, the server's answer applied,
 * and a student's work never lost on the way.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addCard, addDeck, addStarters, addTask, deleteCard, deleteDeck, editCard, EMPTY, gradeCard, removeTask, toggleTask, type AppData } from "../model";
import { applyPull, applyPush, noticeChanges, planPush, REFUSED_RETRY_MS } from "./engine";
import { parsePullPage, parsePushResponse } from "./protocol";
import { emptyShadow } from "./shadow";
import { createSyncClient } from "./client";
import { runPass } from "./runner";
import { Device, FakeServer } from "./testkit";

const T0 = 1_762_400_000_000;
const setup = () => { const server = new FakeServer(); const clock = { t: T0 }; return { server, clock, a: new Device(server, "web-device-a", clock), b: new Device(server, "web-device-b", clock) }; };

const addDeckTo = (d: Device, title: string, subject: string | null = null): string => { d.act((app, now) => addDeck(app, title, now, subject).data); return d.app.decks.find((x) => x.title === title)!.id; };
const addCardTo = (d: Device, deckId: string, front: string, back = "answer"): string => {
  const before = new Set(d.app.cards.map((c) => c.id));
  d.act((app, now) => addCard(app, deckId, front, back, now));
  return d.app.cards.find((c) => !before.has(c.id))!.id;
};
const texts = (d: Device, deckId: string) => d.cardsIn(deckId).map((c) => c.front).sort();
const card = (d: Device, id: string) => d.app.cards.find((c) => c.id === id);

describe("a deck, its cards and a task go up and come down", () => {
  it("what one browser makes, a second one gets, with its schedule", async () => {
    const { a, b, clock } = setup();
    const deck = addDeckTo(a, "Chemistry notes", "Chemistry");
    const c1 = addCardTo(a, deck, "What is a mole?", "6.02e23");
    addCardTo(a, deck, "Define density");
    a.act((app, now) => gradeCard(app, c1, 3, now));
    a.act((app, now) => addTask(app, "Past paper 1", "2026-11-09", now));
    assert.equal((await a.sync()).kind, "done");
    assert.equal((await b.sync()).kind, "done");
    assert.deepEqual(b.app.decks.map((d) => [d.id, d.title, d.subject, d.starter]), [[deck, "Chemistry notes", "Chemistry", null]]);
    assert.deepEqual(texts(b, deck), ["Define density", "What is a mole?"]);
    assert.deepEqual(card(b, c1)!.sch, card(a, c1)!.sch, "the web's own schedule survives the round trip exactly");
    assert.equal(card(b, c1)!.lastReviewed, card(a, c1)!.lastReviewed);
    assert.deepEqual(b.app.tasks.map((t) => [t.text, t.due]), [["Past paper 1", "2026-11-09"]]);
    void clock;
  });

  it("a second pass with nothing changed sends nothing", async () => {
    const { a, server } = setup();
    addCardTo(a, addDeckTo(a, "D"), "q");
    await a.sync();
    const pushes = server.pushes.length;
    await a.sync();
    assert.equal(server.pushes.length, pushes, "no push when nothing changed");
  });

  it("only the group that changed is sent: a review sends the schedule, a typo fix sends the words", async () => {
    const { a, server } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "teh");
    await a.sync();
    a.act((app, now) => gradeCard(app, id, 3, now));
    const review = planPush(a.app, a.shadow, a.clock.t, "web-device-a");
    assert.equal(review.count, 1);
    assert.ok(review.changes.cards[0].sched && !review.changes.cards[0].content, "schedule only");
    await a.sync();
    a.act((app) => editCard(app, id, "the", "answer"));
    const fix = planPush(a.app, a.shadow, a.clock.t, "web-device-a");
    assert.ok(fix.changes.cards[0].content && !fix.changes.cards[0].sched, "words only");
    assert.equal(fix.changes.cards[0].base_content_rev, server.cards.get(id)!.content_rev, "with the revision it last saw");
    assert.equal(fix.changes.cards[0].base_sched_rev, undefined);
  });

  it("p_changes always carries every kind's key, and positions follow the deck's order", () => {
    const { a } = setup();
    const deck = addDeckTo(a, "D");
    addCardTo(a, deck, "one"); addCardTo(a, deck, "two");
    const plan = planPush(a.app, a.shadow, a.clock.t, "web-device-a");
    assert.deepEqual(Object.keys(plan.changes), ["decks", "cards", "tasks", "task_done", "flags"]);
    assert.deepEqual(plan.changes.cards.map((c) => c.content!.position), [0, 1]);
    assert.ok(plan.changes.cards.every((c) => c.base_rev === 0 && c.base_content_rev === 0 && c.base_sched_rev === 0));
    assert.ok(plan.changes.decks.every((d) => d.base_content_rev === 0));
  });
});

describe("two devices", () => {
  it("the same card's words edited on both: both texts survive, the later edit on the card and the earlier as an ordinary card in the same deck", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "original");
    await a.sync(); await b.sync();
    a.act((app) => editCard(app, id, "from A", "answer"));
    b.act((app) => editCard(app, id, "from B", "answer"));   // later
    await a.sync();
    await b.sync();   // B pushes with a stale base: the server keeps both
    await a.sync();
    for (const d of [a, b]) {
      assert.deepEqual(texts(d, deck), ["from A", "from B"], `${d.name} has both`);
      assert.equal(card(d, id)!.front, "from B", "the later edit stays on the card");
    }
    const copy = a.app.cards.find((c) => c.id !== id)!;
    assert.match(copy.id, /^.+~c\d+$/);
    assert.equal(copy.deckId, deck, "in the same deck");
  });

  it("a card reviewed on one device and typo-fixed on another: both survive", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "teh cat");
    await a.sync(); await b.sync();
    a.act((app, now) => gradeCard(app, id, 3, now));
    b.act((app) => editCard(app, id, "the cat", "answer"));
    await a.sync(); await b.sync(); await a.sync();
    for (const d of [a, b]) {
      assert.equal(card(d, id)!.front, "the cat", `${d.name}: the fix`);
      assert.equal(card(d, id)!.sch.state, "learning", `${d.name}: the review`);
      assert.equal(d.app.cards.length, 1, "no copy: different groups never conflict");
    }
    assert.deepEqual(card(a, id)!.sch, card(b, id)!.sch);
  });

  it("a deck deleted on one device while a card is reviewed on another: the deck stays deleted, and nothing is shown that was deleted", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "q");
    await a.sync(); await b.sync();
    a.act((app) => deleteDeck(app, deck));
    b.act((app, now) => gradeCard(app, id, 3, now));
    await a.sync();
    assert.equal(a.server.decks.get(deck)!.deleted_at !== null, true);
    await b.sync();   // B's review goes up (a review never brings a deck back), then B learns the deck is gone
    await a.sync();
    for (const d of [a, b]) { assert.deepEqual(d.app.decks, [], d.name); assert.deepEqual(d.app.cards, [], d.name); }
    assert.equal(a.server.cards.get(id)!.deleted_at, null, "the server did not rewrite the card: only the deck is deleted");
  });

  it("a deck deleted on one device and a card in it edited LATER on another: the deck comes back, with its other cards", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const keep = addCardTo(a, deck, "edited later");
    addCardTo(a, deck, "left alone");
    await a.sync(); await b.sync();
    a.act((app) => deleteDeck(app, deck));
    await a.sync();
    b.act((app) => editCard(app, keep, "edited later!", "answer"));   // after the deletion
    await b.sync();
    await b.sync();
    await a.sync();
    await a.sync();
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
    await a.sync(); await b.sync();
    a.act((app) => deleteCard(app, gone));
    await a.sync(); await b.sync();
    assert.deepEqual(texts(b, deck), ["stays"]);
  });

  it("a task ticked on one device and deleted on another settles on the server's answer, and both end the same", async () => {
    const { a, b } = setup();
    a.act((app, now) => addTask(app, "Read chapter", "2026-11-09", now));
    const id = a.app.tasks[0].id;
    await a.sync(); await b.sync();
    a.act((app, now) => toggleTask(app, id, now));
    b.act((app) => removeTask(app, id));
    await a.sync(); await b.sync(); await a.sync(); await b.sync();
    assert.deepEqual(a.app.tasks.map((t) => [t.id, t.done]), b.app.tasks.map((t) => [t.id, t.done]));
  });
});

describe("first sign-in: a union, never a replace", () => {
  it("local data on both sides: everything from both is there afterwards, nothing replaced", async () => {
    const { a, b } = setup();   // a is the iPad stand-in's account, b a browser with its own notes made before signing in
    const ipadDeck = addDeckTo(a, "iPad deck", "Physics");
    addCardTo(a, ipadDeck, "iPad card");
    a.act((app, now) => addTask(app, "iPad task", "2026-11-10", now));
    await a.sync();
    const webDeck = addDeckTo(b, "Web deck", "Chemistry");
    addCardTo(b, webDeck, "web card");
    b.act((app, now) => addTask(app, "web task", "2026-11-11", now));
    assert.equal(b.shadow.cursor, 0);
    await b.sync();   // first sign-in: push everything with revision 0, then pull everything
    await a.sync();
    for (const d of [a, b]) {
      assert.deepEqual(d.app.decks.map((x) => x.title).sort(), ["Web deck", "iPad deck"], d.name);
      assert.deepEqual(d.app.cards.map((x) => x.front).sort(), ["iPad card", "web card"], d.name);
      assert.deepEqual(d.app.tasks.map((x) => x.text).sort(), ["iPad task", "web task"], d.name);
    }
  });

  it("the same card id with different words on both sides: both texts are kept", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "Shared deck");
    const id = addCardTo(a, deck, "A's words");
    await a.sync();
    // B has never synced but happens to hold the same ids with its own words (an earlier sync lost its shadow)
    b.act((app) => ({ ...app, decks: [...a.app.decks], cards: [{ ...a.app.cards[0], front: "B's words" }] }));
    await b.sync();
    await a.sync();
    for (const d of [a, b]) assert.deepEqual(d.app.cards.map((c) => c.front).sort(), ["A's words", "B's words"], d.name);
    assert.ok(a.app.cards.some((c) => c.id === id));
  });

  it("a lost shadow (storage cleared) is the same merge again: nothing is duplicated or lost", async () => {
    const { a, server } = setup();
    const deck = addDeckTo(a, "D");
    addCardTo(a, deck, "q");
    await a.sync();
    a.shadow = emptyShadow("user-1");   // storage gone
    await a.sync();
    assert.equal(a.app.cards.length, 1);
    assert.equal(a.app.decks.length, 1);
    assert.equal([...server.cards.keys()].length, 1, "no copy: the contents were the same");
  });
});

describe("a change made while a push was in flight", () => {
  it("is not overwritten by that push's answer, and goes next pass on the right base (no false conflict)", async () => {
    const { a, server } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "first");
    await a.sync();
    a.act((app) => editCard(app, id, "second", "answer"));
    // the student types again after the request was sent and before the answer comes back
    server.duringPush = () => { a.act((app) => editCard(app, id, "third", "answer")); server.duringPush = null; };
    await a.sync();
    assert.equal(card(a, id)!.front, "third", "the answer did not overwrite the newer edit");
    await a.sync();
    assert.equal(server.cards.get(id)!.content.front, "third");
    assert.equal(a.app.cards.length, 1, "no conflict copy");
    assert.equal([...server.cards.keys()].length, 1);
  });

  it("applyPush skips a row changed after the snapshot, and keeps it dirty", () => {
    const { a } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "v1");
    const plan = planPush(a.app, a.shadow, a.clock.t, "web-device-a");
    const rows = (front: string) => parsePushResponse({
      rev: 5, applied: 2, conflicts: [], refused: [],
      rows: {
        decks: [{ id: deck, title: "D", subject: null, created_at_ms: 1, rev: 1, content_rev: 1, deleted_at_ms: null }],
        cards: [{ id, deck_id: deck, created_at_ms: 2, content: { position: 0, front, back: "answer", front_image: null, back_image: null }, sched: { core: { due_ms: 1, interval_days: 0, ease: 2.5, lapses: 0, last_reviewed_ms: null }, extra: {} }, rev: 2, content_rev: 2, sched_rev: 2, deleted_at_ms: null, conflict_of: null }],
        tasks: [],
      },
    })!;
    a.act((app) => editCard(app, id, "v2", "answer"));   // after the snapshot
    const m = applyPush(a.app, plan.shadow, rows("v1"), plan.snapshot);
    assert.equal(m.app.cards[0].front, "v2");
    const next = planPush(m.app, m.shadow, a.clock.t + 1, "web-device-a");
    assert.equal(next.count, 1, "still to push");
    assert.equal(next.changes.cards[0].content!.front, "v2");
    assert.equal(next.changes.cards[0].base_content_rev, 2, "from the revision the server confirmed");
    // and if the server's answer holds somebody else's words, the base is NOT advanced (so the next push is seen as stale and both are kept)
    const m2 = applyPush(a.app, plan.shadow, rows("someone else's"), plan.snapshot);
    assert.equal(m2.app.cards[0].front, "v2");
    const again = planPush(m2.app, m2.shadow, a.clock.t + 1, "web-device-a");
    assert.equal(again.changes.cards[0].base_content_rev, 0, "the unseen version has not been 'seen'");
  });
});

describe("offline, then online", () => {
  it("nothing is sent while offline; the queue of changes then goes up once, decks before cards, in order", async () => {
    const { a, server } = setup();
    a.online = false;
    const deck = addDeckTo(a, "D");
    addCardTo(a, deck, "one"); addCardTo(a, deck, "two");
    a.act((app, now) => addTask(app, "task", "2026-11-09", now));
    const first = await a.sync();
    assert.equal(first.kind, "failed");
    assert.equal(server.calls.length, 0, "no call at all while offline");
    addCardTo(a, deck, "three");
    await a.sync();
    assert.equal(server.calls.length, 0);
    a.online = true;
    assert.equal((await a.sync()).kind, "done");
    assert.equal(server.pushes.length, 1, "one push, however many edits piled up");
    const p = server.pushes[0] as { decks: { id: string }[]; cards: { content: { front: string; position: number } }[]; tasks: unknown[] };
    assert.equal(p.decks.length, 1);
    assert.deepEqual(p.cards.map((c) => c.content.front), ["one", "two", "three"]);
    assert.deepEqual(p.cards.map((c) => c.content.position), [0, 1, 2]);
    assert.equal(p.tasks.length, 1);
    assert.deepEqual(Object.keys(server.pushes[0]).slice(0, 3), ["decks", "cards", "tasks"]);
  });

  it("a change made offline is sent with the time it was made, not the time the connection came back", async () => {
    const { a, b, server } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "v0");
    await a.sync(); await b.sync();
    a.act((app) => editCard(app, id, "offline edit", "answer"));
    const madeAt = a.clock.t;
    a.shadow = noticeChanges(a.app, a.shadow, madeAt);   // what the runtime does on every change
    a.clock.t += 3 * 3600_000;   // hours pass offline
    await a.sync();
    assert.equal(server.cards.get(id)!.content_at, madeAt);
  });

  it("a push that fails changes nothing and is simply tried again", async () => {
    const { a, server } = setup();
    addCardTo(a, addDeckTo(a, "D"), "q");
    server.down = { message: "Failed to fetch" };
    assert.equal((await a.sync()).kind, "failed");
    assert.equal(a.app.cards.length, 1);
    server.down = null;
    assert.equal((await a.sync()).kind, "done");
    assert.equal(server.cards.size, 1);
  });
});

describe("never delete from absence", () => {
  it("a pull page that does not mention a row never removes it; only the server's own tombstone does", async () => {
    const { a, b, server } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "q");
    a.act((app, now) => addTask(app, "t", "2026-11-09", now));
    await a.sync(); await b.sync();
    const empty = parsePullPage({ rev: server.rev, next: server.rev, more: false, decks: [], cards: [], tasks: [], task_done: [], flags: [] })!;
    const m = applyPull(b.app, b.shadow, empty);
    assert.deepEqual(m.app, b.app);
    // a page with only other rows
    const other = parsePullPage({ rev: 9, next: 9, more: true, decks: [], cards: [{ id: "someone-else", deck_id: deck, created_at_ms: 1, content: { position: 0, front: "x", back: "y", front_image: null, back_image: null }, sched: { core: { due_ms: 1, interval_days: 0, ease: 2.5, lapses: 0, last_reviewed_ms: null }, extra: {} }, rev: 9, content_rev: 9, sched_rev: 9, deleted_at_ms: null, conflict_of: null }], tasks: [] })!;
    const m2 = applyPull(b.app, b.shadow, other);
    assert.ok(m2.app.cards.some((c) => c.id === id) && m2.app.decks.length === 1 && m2.app.tasks.length === 1);
    // the server's tombstone does
    const tomb = parsePullPage({ rev: 10, next: 10, more: false, decks: [], cards: [{ id, deck_id: deck, created_at_ms: 1, rev: 10, deleted_at_ms: 5 }], tasks: [] })!;
    assert.equal(applyPull(b.app, b.shadow, tomb).app.cards.some((c) => c.id === id), false);
  });

  it("a row deleted here is pushed as a tombstone; a row merely absent from a pull is never invented as a deletion", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    addCardTo(a, deck, "q");
    await a.sync();
    // b has never seen the server: its shadow is empty, so it has nothing it could "delete"
    const plan = planPush(b.app, b.shadow, b.clock.t, "web-device-b");
    assert.equal(plan.count, 0);
    await b.sync();
    assert.equal(b.app.cards.length, 1);
    // a held-back row (its deck deleted locally) is not tombstoned either
    a.act((app) => deleteDeck(app, deck));
    const p = planPush(a.app, a.shadow, a.clock.t, "web-device-a");
    assert.equal(p.changes.decks.filter((d) => d.deleted_at_ms !== undefined).length, 1);
    assert.equal(p.changes.cards.length, 0, "the server does not rewrite a deleted deck's cards, and nor does the website");
  });

  it("the cursor never goes backwards", () => {
    const { a } = setup();
    const s = { ...a.shadow, cursor: 50 };
    const page = parsePullPage({ rev: 60, next: 10, more: false, decks: [], cards: [], tasks: [] })!;
    assert.equal(applyPull(a.app, s, page).shadow.cursor, 50);
  });

  it("many pages are read in turn (200 a page) and the cursor ends at the server's revision", async () => {
    const { a, b, server } = setup();
    const deck = addDeckTo(a, "D");
    for (let i = 0; i < 450; i++) a.act((app, now) => addCard(app, deck, `q${i}`, "a", now));
    await a.sync();
    assert.equal((await b.sync()).kind, "done");
    assert.equal(b.app.cards.length, 450);
    assert.equal(b.shadow.cursor, server.rev);
    const pulls = server.calls.filter((c) => c.name === "sync_pull").length;
    assert.ok(pulls >= 3, `pulled in pages (${pulls} calls)`);
    assert.ok(server.calls.filter((c) => c.name === "sync_pull").every((c) => c.args.p_limit === 200));
  });

  it("more than 1,000 changes of one kind go up in pieces of at most 1,000", async () => {
    const { a, server } = setup();
    const deck = addDeckTo(a, "D");
    for (let i = 0; i < 2300; i++) a.act((app, now) => addCard(app, deck, `q${i}`, "a", now));
    assert.equal((await a.sync()).kind, "done");
    assert.deepEqual(server.pushes.map((p) => (p.cards as unknown[]).length), [1000, 1000, 300]);
    assert.equal(server.cards.size, 2300);
  });
});

describe("a safety cap on the server", () => {
  it("a refused row is remembered as not backed up, calmly, everything else carries on, and it is not sent again every pass", async () => {
    const { a, server } = setup();
    server.caps.cards = 2;
    const deck = addDeckTo(a, "D");
    addCardTo(a, deck, "one"); addCardTo(a, deck, "two"); addCardTo(a, deck, "three");
    a.act((app, now) => addTask(app, "still syncs", "2026-11-09", now));
    const out = await a.sync();
    assert.equal(out.kind, "done");
    assert.equal(out.kind === "done" ? out.notBackedUp : -1, 1);
    assert.equal(server.cards.size, 2);
    assert.equal(server.tasks.size, 1, "the rest of the push was applied");
    assert.equal(a.app.cards.length, 3, "nothing was removed here");
    const pushes = server.pushes.length;
    await a.sync();
    assert.equal(server.pushes.length, pushes, "not sent again at once");
    // after a day it is tried again, and once there is room it goes
    server.caps.cards = 10;
    a.clock.t += REFUSED_RETRY_MS + 1000;
    const final = await a.sync();
    assert.equal(final.kind === "done" ? final.notBackedUp : -1, 0);
    assert.equal(server.cards.size, 3);
  });

  it("a refused row that is then edited is tried again straight away (it may now fit)", async () => {
    const { a, server } = setup();
    server.caps.cards = 0;
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "one");
    await a.sync();
    server.caps.cards = 5;
    a.act((app) => editCard(app, id, "one!", "answer"));
    await a.sync();
    assert.equal(server.cards.size, 1);
  });

  it("a row the server has no record of is sent again as a new one", async () => {
    const { a, server } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "q");
    await a.sync();
    server.cards.delete(id);   // swept away on the server
    a.act((app) => editCard(app, id, "q2", "answer"));
    await a.sync();   // refused no_row: the shadow forgets it
    await a.sync();   // sent as new
    assert.equal(server.cards.get(id)!.content.front, "q2");
  });
});

describe("what never leaves the browser", () => {
  it("generated decks and picture cards are not in the push, and their cards neither", () => {
    const { a } = setup();
    a.act((app, now) => addStarters(app, ["chem-carbonyls"], now));
    a.act((app, now) => addDeck(app, "Mark scheme · Cells", now).data);
    a.act((app, now) => addDeck(app, "Key wording · Forces", now).data);
    a.act((app, now) => addDeck(app, "Mistakes: Moles", now).data);
    for (const t of ["Mark scheme · Cells", "Key wording · Forces", "Mistakes: Moles"]) { const id = a.app.decks.find((d) => d.title === t)!.id; a.act((app, now) => addCard(app, id, "q", "a", now)); }
    const mine = addDeckTo(a, "My notes");
    addCardTo(a, mine, "mine");
    // a picture card in the student's own deck
    a.act((app) => ({ ...app, cards: [...app.cards, { id: "c_pic", deckId: mine, front: "label", back: "marks", createdAt: 5, sch: app.cards[app.cards.length - 1].sch, lastReviewed: null, pic: { part: "84631h-jun25-01-2", f: [{ id: "84631h-jun25-01-2", k: "qp" }] } }] }));
    assert.ok(a.app.decks.length >= 5 && a.app.cards.length >= 5);
    const plan = planPush(a.app, a.shadow, a.clock.t, "web-device-a");
    assert.deepEqual(plan.changes.decks.map((d) => d.title), ["My notes"]);
    assert.deepEqual(plan.changes.cards.map((c) => c.content!.front), ["mine"]);
    assert.ok(!JSON.stringify(plan.changes).includes("c_pic"));
  });

  it("a generated-looking deck that arrives in a pull is ignored, and so are its cards, and it is never tombstoned", async () => {
    const { a, server } = setup();
    server.push("ipad-device-1", {
      decks: [{ id: "G1", title: "Mark scheme · Cells", subject: null, origin: "own", created_at_ms: 1, edited_at_ms: 1, base_content_rev: 0 }, { id: "N1", title: "Mark scheme notes", subject: null, origin: "own", created_at_ms: 1, edited_at_ms: 1, base_content_rev: 0 }],
      cards: [{ id: "GC1", deck_id: "G1", created_at_ms: 1, base_rev: 0, content: { position: 0, front: "x", back: "y", front_image: null, back_image: null }, content_at_ms: 1, base_content_rev: 0, sched: { core: { due_ms: 1, interval_days: 0, ease: 2.5, lapses: 0, last_reviewed_ms: null }, extra: { ios: { box: 0 } } }, sched_at_ms: 1, base_sched_rev: 0 }],
      tasks: [], task_done: [], flags: [],
    });
    await a.sync();
    assert.deepEqual(a.app.decks.map((d) => d.title), ["Mark scheme notes"]);
    assert.equal(a.app.cards.length, 0);
    const plan = planPush(a.app, a.shadow, a.clock.t, "web-device-a");
    assert.equal(plan.count, 0);
  });

  it("a card with a bad id is never sent and is counted as not backed up", () => {
    const { a } = setup();
    const deck = addDeckTo(a, "D");
    a.act((app) => ({ ...app, cards: [{ id: "has a space", deckId: deck, front: "f", back: "b", createdAt: 1, sch: { state: "new", due: 1, interval: 0, ease: 2.5, reps: 0, lapses: 0, step: 0, relearnTo: null }, lastReviewed: null }] }));
    const plan = planPush(a.app, a.shadow, a.clock.t, "web-device-a");
    assert.equal(plan.changes.cards.length, 0);
    assert.equal(Object.keys(plan.shadow.refused).length, 1);
  });
});

describe("what the iPad owns that the web does not show", () => {
  const ipad = (server: FakeServer, changes: object) => server.push("ipad-device-1", { decks: [], cards: [], tasks: [], task_done: [], flags: [], ...changes });
  const ipadDeck = { id: "DECK-1", title: "iPad deck", subject: "Physics", origin: "own", created_at_ms: 1, edited_at_ms: 1, base_content_rev: 0 };
  const ipadCard = { id: "FLASH-1", deck_id: "DECK-1", created_at_ms: 2, base_rev: 0, content: { position: 3, front: "Define density", back: "mass / volume", front_image: "pic.png", back_image: null }, content_at_ms: 2, base_content_rev: 0, sched: { core: { due_ms: 1763000000000, interval_days: 3, ease: 2.3, lapses: 0, last_reviewed_ms: 1762500000000 }, extra: { ios: { box: 2 } } }, sched_at_ms: 3, base_sched_rev: 0 };

  it("a web typo fix on an iPad card writes the words back with the picture name and position, and leaves the iPad's schedule alone", async () => {
    const { a, server } = setup();
    ipad(server, { decks: [ipadDeck], cards: [ipadCard] });
    await a.sync();
    assert.equal(a.app.cards[0].front, "Define density");
    a.act((app) => editCard(app, "FLASH-1", "Define density.", "mass / volume"));
    const plan = planPush(a.app, a.shadow, a.clock.t, "web-device-a");
    const c = plan.changes.cards[0];
    assert.equal(c.content!.front_image, "pic.png");
    assert.equal(c.content!.position, 3);
    assert.equal(c.sched, undefined, "the schedule was not touched");
    await a.sync();
    assert.equal(server.cards.get("FLASH-1")!.content.front_image, "pic.png");
    assert.deepEqual((server.cards.get("FLASH-1")!.sched as { extra: object }).extra, { ios: { box: 2 } }, "the iPad's extra is untouched");
  });

  it("a web review of an iPad card writes the core and the web's extra and keeps the iPad's box", async () => {
    const { a, server } = setup();
    ipad(server, { decks: [ipadDeck], cards: [ipadCard] });
    await a.sync();
    a.act((app, now) => gradeCard(app, "FLASH-1", 3, now));
    await a.sync();
    const extra = (server.cards.get("FLASH-1")!.sched as { extra: { ios: object; web: object } }).extra;
    assert.deepEqual(extra.ios, { box: 2 });
    assert.equal((extra.web as { state: string }).state, "review");
  });

  it("a repeating or hand-written task is held: not shown, never deleted, written back untouched", async () => {
    const { a, server } = setup();
    ipad(server, { tasks: [
      { id: "T-ONCE", text: "plain", subject: null, day: "2026-11-09", repeat_days: 0, has_ink: false, done_at_ms: null, filed_at_ms: null, created_at_ms: 1, sort_order: 4, edited_at_ms: 1, base_rev: 0 },
      { id: "T-REP", text: "weekly", subject: null, day: "2026-11-09", repeat_days: 5, has_ink: false, done_at_ms: null, filed_at_ms: null, created_at_ms: 1, sort_order: 5, edited_at_ms: 1, base_rev: 0 },
      { id: "T-INK", text: "", subject: null, day: "2026-11-09", repeat_days: 0, has_ink: true, done_at_ms: null, filed_at_ms: null, created_at_ms: 1, sort_order: 6, edited_at_ms: 1, base_rev: 0 },
    ] });
    await a.sync();
    assert.deepEqual(a.app.tasks.map((t) => t.id), ["T-ONCE"]);
    assert.ok(a.shadow.rows["task:T-REP"].held && a.shadow.rows["task:T-INK"].held);
    const plan = planPush(a.app, a.shadow, a.clock.t, "web-device-a");
    assert.equal(plan.count, 0, "held tasks are not tombstoned for being absent here");
    // editing the ordinary one keeps its order and filing from the iPad
    a.act((app, now) => toggleTask(app, "T-ONCE", now));
    const edit = planPush(a.app, a.shadow, a.clock.t, "web-device-a").changes.tasks[0];
    assert.equal(edit.sort_order, 4);
    assert.equal(edit.repeat_days, 0);
    await a.sync();
    assert.equal(server.tasks.get("T-REP")!.deleted_at, null);
  });

  it("a task the iPad later makes repeating leaves the list here without being deleted", async () => {
    const { a, server } = setup();
    ipad(server, { tasks: [{ id: "T1", text: "plain", subject: null, day: "2026-11-09", repeat_days: 0, has_ink: false, done_at_ms: null, filed_at_ms: null, created_at_ms: 1, sort_order: 0, edited_at_ms: 1, base_rev: 0 }] });
    await a.sync();
    assert.equal(a.app.tasks.length, 1);
    ipad(server, { tasks: [{ id: "T1", text: "plain", subject: null, day: "2026-11-09", repeat_days: 1, has_ink: false, done_at_ms: null, filed_at_ms: null, created_at_ms: 1, sort_order: 0, edited_at_ms: 99, base_rev: 1 }] });
    await a.sync();
    assert.equal(a.app.tasks.length, 0);
    await a.sync();
    assert.equal(server.tasks.get("T1")!.deleted_at, null);
  });

  it("cards that arrive before their deck wait for it", () => {
    const { a } = setup();
    const row = (id: string) => ({ id, deck_id: "D9", created_at_ms: 1, content: { position: 0, front: id, back: "b", front_image: null, back_image: null }, sched: { core: { due_ms: 1, interval_days: 0, ease: 2.5, lapses: 0, last_reviewed_ms: null }, extra: {} }, rev: 3, content_rev: 3, sched_rev: 3, deleted_at_ms: null, conflict_of: null });
    const p1 = parsePullPage({ rev: 3, next: 3, more: true, decks: [], cards: [row("c1")], tasks: [] })!;
    const m1 = applyPull(a.app, a.shadow, p1);
    assert.equal(m1.app.cards.length, 0, "no deck yet: not shown");
    assert.ok(m1.shadow.rows["card:c1"].held);
    const p2 = parsePullPage({ rev: 4, next: 4, more: false, decks: [{ id: "D9", title: "late deck", subject: null, created_at_ms: 1, rev: 4, content_rev: 4, deleted_at_ms: null }], cards: [], tasks: [] })!;
    const m2 = applyPull(m1.app, m1.shadow, p2);
    assert.deepEqual(m2.app.cards.map((c) => c.id), ["c1"]);
    assert.equal(m2.shadow.rows["card:c1"].held, undefined);
  });
});

describe("applying what the server says to unsent work", () => {
  it("a pulled change never overwrites an unsent edit; the server settles it when the edit is pushed (both kept)", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "base");
    await a.sync(); await b.sync();
    a.act((app) => editCard(app, id, "A's edit", "answer"));
    await a.sync();
    b.act((app) => editCard(app, id, "B's unsent edit", "answer"));
    // B pulls (nothing is pushed first here): A's edit must not overwrite B's unsent one
    const page = parsePullPage(b.server.pull(b.shadow.cursor, 200))!;
    const m = applyPull(b.app, b.shadow, page);
    assert.equal(m.app.cards[0].front, "B's unsent edit");
    b.app = m.app; b.shadow = m.shadow;
    await b.sync(); await a.sync(); await b.sync();
    for (const d of [a, b]) assert.deepEqual(texts(d, deck), ["A's edit", "B's unsent edit"], d.name);
  });

  it("a server tombstone for a card edited here (and not yet pushed) does not remove the edit", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "q");
    await a.sync(); await b.sync();
    a.act((app) => deleteCard(app, id));
    await a.sync();
    b.act((app) => editCard(app, id, "edited after", "answer"));
    const page = parsePullPage(b.server.pull(b.shadow.cursor, 200))!;
    const m = applyPull(b.app, b.shadow, page);
    assert.equal(m.app.cards.length, 1, "unsent work is kept");
    b.app = m.app; b.shadow = m.shadow;
    await b.sync(); await a.sync();
    assert.deepEqual(texts(a, deck), ["edited after"], "the later edit won over the deletion, on the server's say");
  });

  it("a server tombstone for a deck whose cards hold unsent work keeps the deck until that work is up", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "q");
    await a.sync(); await b.sync();
    a.act((app) => deleteDeck(app, deck));
    await a.sync();
    b.act((app, now) => gradeCard(app, id, 3, now));   // unsent review
    const page = parsePullPage(b.server.pull(b.shadow.cursor, 200))!;
    const m = applyPull(b.app, b.shadow, page);
    assert.equal(m.app.decks.length, 1);
    assert.equal(m.app.cards.length, 1);
    b.app = m.app; b.shadow = m.shadow;
    await b.sync();   // the review goes up; once it has, the deck can go
    assert.equal(b.app.decks.length, 0);
  });

  it("a conflict copy is an ordinary card: it can be edited and reviewed like any other", async () => {
    const { a, b } = setup();
    const deck = addDeckTo(a, "D");
    const id = addCardTo(a, deck, "base");
    await a.sync(); await b.sync();
    a.act((app) => editCard(app, id, "A", "answer"));
    b.act((app) => editCard(app, id, "B", "answer"));
    await a.sync(); await b.sync(); await a.sync();
    const copy = a.app.cards.find((c) => c.id !== id)!;
    a.act((app, now) => gradeCard(editCard(app, copy.id, copy.front + " (fixed)", "answer"), copy.id, 4, now));
    await a.sync(); await b.sync();
    assert.ok(b.app.cards.some((c) => c.front.endsWith("(fixed)") && c.sch.state === "review"));
  });
});

describe("noticing", () => {
  it("returns the same shadow when nothing changed", async () => {
    const { a } = setup();
    addCardTo(a, addDeckTo(a, "D"), "q");
    await a.sync();
    assert.equal(noticeChanges(a.app, a.shadow, a.clock.t + 5), a.shadow);
  });
  it("an app that has never synced has nothing to notice and nothing is invented", () => {
    assert.equal(noticeChanges(EMPTY, emptyShadow("x"), 1).rows !== undefined, true);
    const plan = planPush(EMPTY as AppData, emptyShadow("x"), 1, "web-device-a");
    assert.equal(plan.count, 0);
  });
});

describe("the pass itself", () => {
  it("with no account, or an anonymous one, it makes no call at all", async () => {
    const { a, server } = setup();
    addCardTo(a, addDeckTo(a, "D"), "q");
    const run = (account: { id: string; anonymous?: boolean } | null) => runPass({
      client: createSyncClient(server.api("user-1")), account, device: "web-device-a", now: () => a.clock.t, online: () => true,
      getApp: () => a.app, update: () => {}, save: () => {}, current: () => true,
    }, a.shadow);
    assert.equal((await run(null)).kind, "skipped");
    assert.equal((await run({ id: "anon", anonymous: true })).kind, "skipped");
    assert.equal(server.calls.length, 0);
    assert.equal((await run({ id: "user-1" })).kind, "done");
    assert.ok(server.calls.length > 0);
  });
});
