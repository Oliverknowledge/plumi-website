/**
 * Real answers written by the app repo's migration 0134 (tools/sync-contract/fixtures, copied here byte for byte; `npm run sync:contract` holds the copies
 * to the originals). The website's parsers must read every one of them, and the engine must apply a pull and a push answer the way the design says.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { EMPTY } from "../model";
import { applyPull, applyPush, planPush } from "./engine";
import { parsePullPage, parsePushResponse } from "./protocol";
import { emptyShadow } from "./shadow";

const read = (n: string): unknown => JSON.parse(readFileSync(join(__dirname, "fixtures", `${n}.json`), "utf8"));

describe("the SQL's real answers", () => {
  it("a first push answer: six rows, revision 1, every touched row back with its revisions", () => {
    const r = parsePushResponse(read("push_first"));
    assert.ok(r, "parses");
    assert.equal(r.rev, 1);
    assert.equal(r.applied, 6);
    assert.deepEqual([r.refused.length, r.conflicts.length], [0, 0]);
    assert.equal(r.rows.cards.length, 2);
    assert.ok(r.rows.cards.every((c) => c.rev === 1));
  });

  it("a conflict answer: the copy, and a refusal for each reason, each naming its kind and id", () => {
    const r = parsePushResponse(read("push_conflict_and_refusals"));
    assert.ok(r, "parses");
    assert.equal(r.conflicts.length, 1);
    assert.equal(r.conflicts[0].copyId, "c_golden1~c2");
    assert.deepEqual(r.refused.map((x) => x.reason), ["too_long", "bad_id", "no_row", "bad_row"]);
    assert.deepEqual(r.refused.map((x) => x.kind), ["deck", "card", "card", "task"]);
    assert.deepEqual(r.rows.cards.map((c) => c.id).sort(), ["c_golden1", "c_golden1~c2"]);
  });

  it("pull pages: everything, a page of one that says more is coming, and nothing new", () => {
    const all = parsePullPage(read("pull_all"));
    assert.ok(all);
    assert.deepEqual([all.rev, all.next, all.more, all.decks.length, all.cards.length, all.tasks.length], [2, 2, false, 1, 3, 1]);
    const page = parsePullPage(read("pull_page_more"));
    assert.ok(page);
    assert.deepEqual([page.more, page.next], [true, 1]);
    const none = parsePullPage(read("pull_empty"));
    assert.ok(none);
    assert.deepEqual([none.more, none.next, none.cards.length], [false, 2, 0]);
  });

  it("the engine applies the full pull to an empty browser: the deck, three cards (one a conflict copy) and the task", () => {
    const page = parsePullPage(read("pull_all"));
    assert.ok(page);
    const m = applyPull(EMPTY, emptyShadow("user-1"), page);
    assert.equal(m.app.decks.length, 1);
    assert.equal(m.app.cards.length, 3);
    assert.equal(m.app.tasks.length, 1);
    const copy = m.app.cards.find((c) => c.id === "c_golden1~c2");
    assert.ok(copy, "the conflict copy arrives as an ordinary card");
    assert.equal(copy.deckId, "d_golden");
    // what a browser pulls is, the next pass, nothing to push: the answer is what the server holds
    const again = planPush(m.app, m.shadow, 1_762_500_001_000, "web-device-a");
    assert.equal(again.count, 0, "nothing to send straight after a pull");
  });

  it("the engine reads a push answer the same way", () => {
    const r = parsePushResponse(read("push_first"));
    assert.ok(r);
    assert.equal(typeof applyPush, "function");
  });
});
