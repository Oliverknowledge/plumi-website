import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NO_FEED } from "./feed";
import { cleanFilters, EMPTY_FEED_PREFS, isPlain, parseFeedPrefs, subjectFor, viewFor } from "./feedView";

describe("the feed's remembered choices", () => {
  test("nothing, or nonsense, is nothing remembered", () => {
    assert.deepEqual(parseFeedPrefs(null), EMPTY_FEED_PREFS);
    assert.deepEqual(parseFeedPrefs("not json"), EMPTY_FEED_PREFS);
    assert.deepEqual(parseFeedPrefs("[1,2]"), EMPTY_FEED_PREFS);
    assert.deepEqual(parseFeedPrefs('"x"'), EMPTY_FEED_PREFS);
  });
  test("a good record comes back as it was written", () => {
    const rec = { last: "aqa-gcse-physics", view: { "aqa-gcse-physics": "papers" }, filters: { "aqa-gcse-physics": { ...NO_FEED, topics: ["4.1.1"], sort: "mix", seed: "ab12", calc: "only" } }, pos: { "aqa-gcse-physics": { id: "84631h-jun25-01-1", off: 40 } }, folded: { x: true } };
    const p = parseFeedPrefs(JSON.stringify(rec));
    assert.equal(p.last, "aqa-gcse-physics");
    assert.equal(viewFor(p, "aqa-gcse-physics"), "papers");
    assert.deepEqual(p.filters["aqa-gcse-physics"].topics, ["4.1.1"]);
    assert.equal(p.filters["aqa-gcse-physics"].sort, "mix");
    assert.equal(p.filters["aqa-gcse-physics"].calc, "only");
    assert.deepEqual(p.pos["aqa-gcse-physics"], { id: "84631h-jun25-01-1", off: 40 });
    assert.equal(p.folded.x, true);
  });
  test("bad values are dropped one by one", () => {
    const p = parseFeedPrefs(JSON.stringify({ last: 5, view: { a: "papers", b: "lists" }, filters: { a: { topics: [1, "t"], sort: "sideways", calc: "x", q: 7 } }, pos: { a: { id: 1, off: 2 }, b: { id: "x", off: "far" }, c: { id: "ok", off: -5 } } }));
    assert.equal(p.last, null);
    assert.deepEqual(p.view, { a: "papers" });
    assert.deepEqual(p.filters.a.topics, ["t"]);
    assert.equal(p.filters.a.sort, "new");
    assert.equal(p.filters.a.calc, "");
    assert.equal(p.filters.a.q, "");
    assert.deepEqual(p.pos, { c: { id: "ok", off: 0 } });
  });
  test("the view a subject opens on is the last used, else Questions", () => {
    assert.equal(viewFor(EMPTY_FEED_PREFS, "x"), "questions");
  });
  test("the subject to open on is the last used while it is still theirs, else the first", () => {
    const p = parseFeedPrefs(JSON.stringify({ last: "b" }));
    assert.equal(subjectFor(p, ["a", "b"]), "b");
    assert.equal(subjectFor(p, ["a", "c"]), "a");
    assert.equal(subjectFor(p, []), null);
  });
  test("plain filters are plain whatever the seed", () => {
    assert.equal(isPlain({ ...NO_FEED, seed: "zz" }), true);
    assert.equal(isPlain({ ...NO_FEED, q: "x" }), false);
  });
  test("cleanFilters of nothing is no filters", () => assert.deepEqual(cleanFilters(undefined), NO_FEED));
});
