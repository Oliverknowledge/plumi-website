import assert from "node:assert/strict";
import { test } from "node:test";
import type { LibraryMessage } from "@/lib/social/lobby";
import { BUBBLE_CHARS, BubbleFeed, bubbleText } from "./bubbles";

const ME = "aaaaaaaa-0000-4000-8000-000000000001";
const A = "aaaaaaaa-0000-4000-8000-000000000002";
const B = "aaaaaaaa-0000-4000-8000-000000000003";
let n = 0;
const msg = (senderId: string, body: string, extra: Partial<LibraryMessage> = {}): LibraryMessage =>
  ({ id: String(++n), shard: 1, senderId, name: "x", body, createdAt: 1000 + n, hidden: false, pro: false, ...extra });

test("nothing before the chat has loaded, and history is not replayed", () => {
  const f = new BubbleFeed(ME);
  assert.deepEqual(f.feed([msg(A, "early")], false), []);
  const history = [msg(A, "hello"), msg(B, "hi")];
  assert.deepEqual(f.feed(history, true), [], "the first read is the baseline");
  assert.deepEqual(f.feed(history, true), [], "and asking again says nothing");
});

test("a new message is a bubble for its sender, once", () => {
  const f = new BubbleFeed(ME);
  const history = [msg(A, "hello")];
  f.feed(history, true);
  const next = [...history, msg(B, "anyone doing maths?")];
  const out = f.feed(next, true);
  assert.equal(out.length, 1);
  assert.equal(out[0].who, B);
  assert.equal(out[0].text, "anyone doing maths?");
  assert.deepEqual(f.feed(next, true), []);
});

test("one bubble per person: their newest of a batch wins, others keep theirs", () => {
  const f = new BubbleFeed(ME);
  f.feed([], true);
  const out = f.feed([msg(A, "one"), msg(B, "mine"), msg(A, "two")], true);
  assert.deepEqual(out.map((b) => [b.who, b.text]), [[B, "mine"], [A, "two"]]);
});

test("your own message is a bubble over you", () => {
  const f = new BubbleFeed(ME.toUpperCase());
  f.feed([], true);
  const out = f.feed([msg(ME, "revising now")], true);
  assert.deepEqual(out.map((b) => b.who), ["you"]);
});

test("a hidden or empty message gets no bubble, and is not shown later either", () => {
  const f = new BubbleFeed(ME);
  f.feed([], true);
  const all = [msg(A, "rude", { hidden: true }), msg(B, "   ")];
  assert.deepEqual(f.feed(all, true), []);
  assert.deepEqual(f.feed(all.map((m) => ({ ...m, hidden: false })), true), []);
});

test("switching library resets the baseline", () => {
  const f = new BubbleFeed(ME);
  f.feed([msg(A, "old")], true);
  assert.deepEqual(f.feed([], false), []);                       // the visit empties the messages and the chat is not loaded
  const there = msg(B, "already here");
  assert.deepEqual(f.feed([there], true), [], "the new library's history is the baseline");
  assert.equal(f.feed([there, msg(A, "new")], true).length, 1);
});

test("text is one tidy short line, cut on whole characters", () => {
  assert.equal(bubbleText("  two   spaces\nand a line  "), "two spaces and a line");
  const long = "a".repeat(BUBBLE_CHARS + 20);
  const cut = bubbleText(long);
  assert.equal(Array.from(cut).length, BUBBLE_CHARS);
  assert.ok(cut.endsWith("…"));
  const emoji = "\u{1F600}".repeat(BUBBLE_CHARS + 5);
  assert.ok(Array.from(bubbleText(emoji)).every((c) => c === "\u{1F600}" || c === "…"), "no half an emoji");
  assert.equal(bubbleText("short"), "short");
});
