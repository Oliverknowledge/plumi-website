/**
 * npm run sync:test (node:test through tsx; no network, no browser)
 *
 * The mapper and the contract: the golden vectors in CONTRACT.json reproduced exactly, the schedule split into core and extra, what is and is not
 * backed up, and the contract file held to its copy.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Card, Deck, Task } from "../model";
import { newSchedule } from "../srs";
import { CONTRACT, GENERATED_TITLE_PREFIXES, KIND_KEYS, PULL_PAGE, SYNC_LIMITS, SYNC_RPC } from "./contract";
import {
  cardFromWire, cardToWire, deckToWire, hashOf, isGeneratedDeck, parseServerCard, parseServerTask, scheduleFromWire, scheduleToWire, taskFromWire, taskHeldReason, taskToWire,
  validId, type ServerCard, type WireSched,
} from "./mapper";

const V = CONTRACT.vectors;

describe("the contract file", () => {
  it("is what contract.ts reads", () => {
    assert.equal(SYNC_RPC.push.name, "sync_push");
    assert.deepEqual(SYNC_RPC.push.args, ["p_device", "p_changes"]);
    assert.equal(SYNC_RPC.pull.name, "sync_pull");
    assert.deepEqual(SYNC_RPC.pull.args, ["p_since", "p_limit"]);
    assert.equal(SYNC_LIMITS.changesPerKindPerPush, 1000);
    assert.equal(SYNC_LIMITS.cardSide, 5000);
    assert.equal(SYNC_LIMITS.deckTitle, 200);
    assert.deepEqual(KIND_KEYS, { deck: "decks", card: "cards", task: "tasks", task_done: "task_done", flag: "flags" });
    assert.deepEqual([...GENERATED_TITLE_PREFIXES], ["Key wording ·", "Mark scheme ·", "Mistakes:"]);
    assert.ok(PULL_PAGE <= SYNC_LIMITS.pullLimitMax);
  });

  it("npm run sync:contract skips with no source, passes on an identical copy, fails on any difference", () => {
    const run = (env: Record<string, string>) => spawnSync("npx", ["tsx", "scripts/sync-contract.ts"], { cwd: join(__dirname, "..", "..", "..", ".."), env: { ...process.env, SYNC_CONTRACT_SOURCE: "", ...env }, encoding: "utf8" });
    const skipped = run({});
    assert.equal(skipped.status, 0);
    assert.match(skipped.stdout, /skipped \(no SYNC_CONTRACT_SOURCE\)/);
    const dir = mkdtempSync(join(tmpdir(), "sync-contract-"));
    const copy = join(__dirname, "CONTRACT.json");
    copyFileSync(copy, join(dir, "CONTRACT.json"));
    assert.equal(run({ SYNC_CONTRACT_SOURCE: dir }).status, 0, "identical");
    writeFileSync(join(dir, "CONTRACT.json"), readFileSync(copy, "utf8").replace('"version": 1', '"version": 2'));
    const diff = run({ SYNC_CONTRACT_SOURCE: dir });
    assert.equal(diff.status, 1, "one changed byte fails");
    assert.match(diff.stderr, /differs/);
  });
});

describe("golden vectors", () => {
  it("a web card maps to exactly the contract's wire card", () => {
    const g = V.card_web_to_wire;
    const card = g.web as unknown as Card;
    assert.deepEqual(cardToWire(card, g.position), g.wire);
  });

  it("the golden web card comes back from its wire form unchanged (nothing is lost in the round trip)", () => {
    const g = V.card_web_to_wire;
    const server = parseServerCard({ ...g.wire, content_at_ms: 1, sched_at_ms: 1, rev: 5, content_rev: 5, sched_rev: 5, deleted_at_ms: null, conflict_of: null })!;
    const back = cardFromWire(server);
    assert.deepEqual(back.card, g.web);
    assert.equal(back.keep.position, g.position);
  });

  it("an iPad card's wire form becomes an ordinary web card, and the iPad's extra is kept to be written back untouched", () => {
    const g = V.card_ios_to_wire;
    const server = parseServerCard({ ...g.wire, content_at_ms: 1, sched_at_ms: 1, rev: 3, content_rev: 3, sched_rev: 3, deleted_at_ms: null, conflict_of: null })!;
    const { card, keep } = cardFromWire(server);
    assert.equal(card.id, "FLASH-GOLDEN-0001");
    assert.equal(card.deckId, "DECK-GOLDEN-0001");
    assert.equal(card.front, "Define density");
    assert.equal(card.createdAt, 1762400000000);
    assert.equal(card.lastReviewed, 1762500000000);
    // a sensible web schedule, rebuilt from the core: reviewed, a few days, ease and lapses as given
    assert.deepEqual(card.sch, { state: "review", due: 1763000000000, interval: 3, ease: 2.3, reps: 1, lapses: 0, step: 0, relearnTo: null });
    assert.deepEqual(keep.extra, { ios: { box: 2 } });
    // written back: the core is exactly the iPad's, its extra is untouched, and the web adds its own
    const wire = cardToWire(card, keep.position ?? 0, keep);
    assert.deepEqual(wire.sched.core, g.wire.sched.core);
    assert.deepEqual(wire.sched.extra.ios, { box: 2 });
    assert.deepEqual(wire.sched.extra.web, { state: "review", reps: 1, step: 0, relearn_to: null });
    assert.deepEqual(wire.content, g.wire.content);
  });

  it("a web task maps to exactly the contract's wire task, repeat_days 0 and has_ink false", () => {
    const g = V.task_web_to_wire;
    assert.deepEqual(taskToWire(g.web as unknown as Task), g.wire);
  });

  it("the golden titles: generated ones are not synced, the look-alikes are", () => {
    const deck = (title: string, starter: string | null = null): Deck => ({ id: "d1", title, subject: null, createdAt: 1, starter });
    for (const t of V.not_synced_titles) assert.ok(isGeneratedDeck(deck(t)), t);
    for (const t of V.synced_titles) assert.ok(!isGeneratedDeck(deck(t)), t);
    assert.ok(isGeneratedDeck(deck("Chemistry · Rates", "pm:chem:aqa:rates")), "a catalogue deck (starter set) is not synced whatever it is called");
    assert.ok(isGeneratedDeck(deck("My mistakes · Physics", "mistakes:physics")));
  });
});

describe("schedules", () => {
  const web = { state: "review" as const, due: 5_000, interval: 6, ease: 2.5, reps: 4, lapses: 1, step: 0, relearnTo: null };

  it("the web schedule splits into the core and the web's own extra, and joins back exactly", () => {
    const w = scheduleToWire(web, 4_000);
    assert.deepEqual(w.core, { due_ms: 5_000, interval_days: 6, ease: 2.5, lapses: 1, last_reviewed_ms: 4_000 });
    assert.deepEqual(w.extra, { web: { state: "review", reps: 4, step: 0, relearn_to: null } });
    assert.deepEqual(scheduleFromWire(w, 4_000), web);
  });

  it("a lapsed card in relearning keeps its own state through the wire", () => {
    const relearn = { state: "learning" as const, due: 9, interval: 0, ease: 2.3, reps: 7, lapses: 2, step: 1, relearnTo: 5 };
    assert.deepEqual(scheduleFromWire(scheduleToWire(relearn, 8), 8), relearn);
  });

  it("another platform's extra is carried through untouched, and the web's own is never taken from it", () => {
    const w = scheduleToWire(web, 4_000, { ios: { box: 3, future: { a: 1 } }, android: [1], web: { state: "new" } });
    assert.deepEqual(w.extra.ios, { box: 3, future: { a: 1 } });
    assert.deepEqual(w.extra.android, [1]);
    assert.equal((w.extra.web as { state: string }).state, "review");
  });

  it("a web extra that no longer fits the core (the iPad reviewed it since) is rebuilt from the core", () => {
    // the web wrote "learning", then an iPad graduated the card to 3 days and left the web's extra as it was
    const stale: WireSched = { core: { due_ms: 9, interval_days: 3, ease: 2.5, lapses: 0, last_reviewed_ms: 8 }, extra: { web: { state: "learning", reps: 0, step: 1, relearn_to: null }, ios: { box: 2 } } };
    assert.equal(scheduleFromWire(stale, 8).state, "review");
    const fresh: WireSched = { core: { due_ms: 9, interval_days: 0, ease: 2.5, lapses: 0, last_reviewed_ms: null }, extra: {} };
    assert.deepEqual(scheduleFromWire(fresh, null), { state: "new", due: 9, interval: 0, ease: 2.5, reps: 0, lapses: 0, step: 0, relearnTo: null });
    const young: WireSched = { core: { due_ms: 9, interval_days: 0, ease: 2.5, lapses: 1, last_reviewed_ms: 7 }, extra: {} };
    assert.equal(scheduleFromWire(young, 7).state, "learning");
  });

  it("an ease outside the contract's range is clamped on the way out and the way in", () => {
    assert.equal(scheduleToWire({ ...web, ease: 4.6 }, 1).core.ease, 4);
    assert.equal(scheduleToWire({ ...web, ease: 1.1 }, 1).core.ease, 1.3);
    const w: WireSched = { core: { due_ms: 1, interval_days: 2, ease: 9, lapses: 0, last_reviewed_ms: 1 }, extra: {} };
    assert.equal(scheduleFromWire(w, 1).ease, 4);
  });
});

describe("what is backed up", () => {
  const card = (over: Partial<Card> = {}): Card => ({ id: "c1", deckId: "d1", front: "f", back: "b", createdAt: 1, sch: newSchedule(1), lastReviewed: null, ...over });

  it("limits are applied on the way out (a side is cut at the contract's length, a title too)", () => {
    const wire = cardToWire(card({ front: "x".repeat(6000) }), 0);
    assert.equal(wire.content.front.length, SYNC_LIMITS.cardSide);
    assert.equal(deckToWire({ id: "d", title: "t".repeat(300), subject: "s".repeat(100), createdAt: 1, starter: null }).title.length, SYNC_LIMITS.deckTitle);
    assert.equal(deckToWire({ id: "d", title: "t", subject: "s".repeat(100), createdAt: 1, starter: null }).subject!.length, SYNC_LIMITS.deckSubject);
  });

  it("a picture file name from an iPad is carried by name only and written back as it came", () => {
    const wire = cardToWire(card(), 0, { frontImage: "front.png", backImage: null });
    assert.equal(wire.content.front_image, "front.png");
    assert.equal(wire.content.back_image, null);
  });

  it("ids are checked against the contract's pattern", () => {
    assert.ok(validId("c_mhx3k_1abcd1234"));
    assert.ok(validId("FLASH-GOLDEN-0001"));
    assert.ok(validId("abc~c12"));
    assert.ok(!validId(""));
    assert.ok(!validId("x".repeat(49)));
    assert.ok(!validId("has space"));
    assert.ok(!validId("slash/slash"));
  });

  it("a task that repeats, has ink or has no day is held, not shown as an ordinary task", () => {
    const base = { id: "t1", text: "x", subject: null, day: "2026-11-09", repeatDays: 0, hasInk: false, doneAt: null, filedAt: null, createdAt: 1, sortOrder: 0, rev: 1, deletedAt: null };
    assert.equal(taskHeldReason(base), null);
    assert.equal(taskHeldReason({ ...base, repeatDays: 5 }), "repeating");
    assert.equal(taskHeldReason({ ...base, hasInk: true }), "ink");
    assert.equal(taskHeldReason({ ...base, day: null }), "undated");
    assert.equal(taskFromWire({ ...base, repeatDays: 1 }), null);
    assert.deepEqual(taskFromWire({ ...base, doneAt: 9 })!.task, { id: "t1", text: "x", subject: null, due: "2026-11-09", done: true, createdAt: 1, doneAt: 9 });
  });

  it("a task ticked off with no time is sent with its creation time, not as undone", () => {
    assert.equal(taskToWire({ id: "t", text: "x", subject: null, due: "2026-01-01", done: true, createdAt: 77, doneAt: null }).done_at_ms, 77);
  });

  it("rows from the server that are not well formed are dropped, never guessed at", () => {
    assert.equal(parseServerCard(null), null);
    assert.equal(parseServerCard({ id: "c", deck_id: "d", created_at_ms: 1, rev: 1, deleted_at_ms: null, content: { front: 1 } }), null);
    assert.equal(parseServerCard({ id: "bad id", deck_id: "d", created_at_ms: 1, rev: 1 }), null);
    assert.equal(parseServerTask({ id: "t", text: 5 }), null);
    const tomb: ServerCard | null = parseServerCard({ id: "c", deck_id: "d", created_at_ms: 1, rev: 4, deleted_at_ms: 99 });
    assert.equal(tomb?.deletedAt, 99, "a tombstone may come without its words");
  });

  it("the fingerprint ignores key order and tells a change from none", () => {
    assert.equal(hashOf({ a: 1, b: [1, 2] }), hashOf({ b: [1, 2], a: 1 }));
    assert.notEqual(hashOf(["a", "b"]), hashOf(["ab", ""]));
    assert.notEqual(hashOf(["x", null]), hashOf(["x", "null"]));
  });
});
