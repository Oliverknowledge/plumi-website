import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { offerLabel, sameIds, settle, TEXT_WAIT_MS, TOP_PX, type SettleIn } from "./feedSettle";

const base: SettleIn = { shownIds: ["a", "b"], nextIds: ["a", "b", "c"], intentChanged: false, waitingForText: false, waitedMs: 0, scrollY: 0, viewportH: 800 };

describe("when a list may be replaced", () => {
  test("the same questions in the same order change nothing", () => {
    assert.equal(settle({ ...base, nextIds: ["a", "b"], scrollY: 5000 }), "same");
    assert.ok(sameIds([], []));
    assert.ok(!sameIds(["a", "b"], ["b", "a"]));
  });
  test("what the student asked for is shown at once, wherever they are", () => {
    assert.equal(settle({ ...base, intentChanged: true, scrollY: 5000 }), "apply");
  });
  test("a late change at the very top of the page is taken quietly (nothing has been scrolled)", () => {
    assert.equal(settle({ ...base, scrollY: 0 }), "apply");
    assert.equal(settle({ ...base, scrollY: TOP_PX }), "apply");
  });
  test("a late change further down is held and offered", () => {
    assert.equal(settle({ ...base, scrollY: TOP_PX + 1 }), "offer");
    assert.equal(settle({ ...base, scrollY: 380 }), "offer");
    assert.equal(settle({ ...base, scrollY: 900 }), "offer");
    assert.equal(settle({ ...base, scrollY: 6000, nextIds: ["x"] }), "offer");
  });
});

describe("a search waits for the papers' text, but not for long", () => {
  const typed: SettleIn = { ...base, intentChanged: true, waitingForText: true };
  test("it waits while the text is on its way", () => {
    assert.equal(settle({ ...typed, waitedMs: 0 }), "wait");
    assert.equal(settle({ ...typed, waitedMs: TEXT_WAIT_MS - 1 }), "wait");
  });
  test("after 2.5 seconds the list from the titles is shown", () => {
    assert.equal(TEXT_WAIT_MS, 2500);
    assert.equal(settle({ ...typed, waitedMs: TEXT_WAIT_MS }), "apply");
  });
  test("with the text here (or failed) there is no waiting", () => {
    assert.equal(settle({ ...typed, waitingForText: false }), "apply");
  });
  test("a search that finds the same questions changes nothing", () => {
    assert.equal(settle({ ...typed, nextIds: ["a", "b"] }), "same");
  });
});

describe("the held list's chip", () => {
  test("more results, or the same questions changed", () => {
    assert.equal(offerLabel(12, 25), "More results found. Show them");
    assert.equal(offerLabel(12, 12), "The list has changed. Show it");
    assert.equal(offerLabel(12, 3), "The list has changed. Show it");
  });
  test("no em dash in what a student reads", () => {
    assert.ok(!/—/.test(offerLabel(1, 2) + offerLabel(2, 1)));
  });
});
