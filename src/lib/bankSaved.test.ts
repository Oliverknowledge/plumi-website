import assert from "node:assert/strict";
import { test } from "node:test";
import { bookmarkedIn, mergeItems, NOTE_MAX, toSend, withBookmark, withNote, type SavedEntry, type SavedItems } from "./bankSaved";

const entry = (b: boolean, n: string, at: number, s = "maths"): SavedEntry => ({ s, b, n, at });

test("a bookmark can come off and leaves the note", () => {
  assert.deepEqual(withBookmark(entry(true, "chain rule", 1), "maths", false, 2), entry(false, "chain rule", 2));
  assert.deepEqual(withBookmark(undefined, "maths", true, 2), entry(true, "", 2));
});

test("a first note bookmarks its question", () => {
  assert.deepEqual(withNote(undefined, "maths", "chain rule", 2), entry(true, "chain rule", 2));
  assert.deepEqual(withNote(entry(false, "", 1), "maths", "chain rule", 2), entry(true, "chain rule", 2));
});

test("changing a note doesn't bring back a bookmark taken off", () => {
  assert.equal(withNote(entry(false, "chain rule", 1), "maths", "product rule", 2).b, false);
});

test("emptying a note keeps the bookmark, and only spaces count as empty", () => {
  assert.deepEqual(withNote(entry(true, "chain rule", 1), "maths", "   ", 2), entry(true, "", 2));
  assert.equal(withNote(undefined, "maths", "  ", 2).b, false);
});

test("a note is cut to the limit", () => {
  assert.equal(withNote(undefined, "maths", "x".repeat(NOTE_MAX + 50), 2).n.length, NOTE_MAX);
});

test("merging: the later change wins, whole, either way round", () => {
  const items: SavedItems = { a: entry(true, "here", 5), b: entry(true, "here", 1) };
  const merged = mergeItems(items, [{ part: "a", entry: entry(false, "there", 3) }, { part: "b", entry: entry(false, "there", 3) }, { part: "c", entry: entry(true, "", 3) }]);
  assert.deepEqual(merged, { a: entry(true, "here", 5), b: entry(false, "there", 3), c: entry(true, "", 3) });
});

test("merging: a bookmark taken off on another device stays off", () => {
  const merged = mergeItems({ a: entry(true, "", 1) }, [{ part: "a", entry: entry(false, "", 2) }]);
  assert.deepEqual(bookmarkedIn(merged, "maths"), new Set());
});

test("merging nothing new returns the same object, so nothing is written", () => {
  const items: SavedItems = { a: entry(true, "", 5) };
  assert.equal(mergeItems(items, [{ part: "a", entry: entry(true, "", 5) }, { part: "a", entry: entry(false, "", 2) }]), items);
});

test("the account is sent what it lacks or has older, including what's been taken off", () => {
  const items: SavedItems = { same: entry(true, "", 5), newer: entry(false, "", 6), older: entry(true, "", 1), absent: entry(true, "", 1) };
  const send = toSend(items, [{ part: "same", at: 5 }, { part: "newer", at: 2 }, { part: "older", at: 3 }]);
  assert.deepEqual(send.sort(), ["absent", "newer"]);
});

test("bookmarks are per bank", () => {
  const items: SavedItems = { a: entry(true, "", 1), b: entry(false, "note", 1), c: entry(true, "", 1, "physics") };
  assert.deepEqual(bookmarkedIn(items, "maths"), new Set(["a"]));
});
