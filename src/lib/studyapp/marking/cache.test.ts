import { test } from "node:test";
import assert from "node:assert/strict";
import { answerKey, CACHE_KEY, CACHE_MAX, getCached, putCached, type KV } from "./cache";
import type { MarkReply } from "./api";

const reply = (marks: number): MarkReply => ({ marks, outOf: 2, anyHeld: false, rulesVersion: 1, packHash: null, points: [{ n: 1, status: "not_awarded", evidence: null, reason: "r" }] });
const store = (): KV & { raw: Map<string, string> } => { const raw = new Map<string, string>(); return { raw, getItem: (k) => raw.get(k) ?? null, setItem: (k, v) => { raw.set(k, v); } }; };

test("the same words in the same place are the same key; spacing does not matter, words and place do", () => {
  const k = answerKey("b", "p-1-1", 3, "it activates enzymes");
  assert.equal(answerKey("b", "p-1-1", 3, "  it   activates\n enzymes "), k);
  assert.notEqual(answerKey("b", "p-1-1", 3, "it activates enzyme"), k);
  assert.notEqual(answerKey("b", "p-1-2", 3, "it activates enzymes"), k);
  assert.notEqual(answerKey("b", "p-1-1", 4, "it activates enzymes"), k);
  assert.notEqual(answerKey("c", "p-1-1", 3, "it activates enzymes"), k);
});
test("a stored mark comes back for the same key and not for another", () => {
  const kv = store(); putCached(kv, "a", reply(1)); putCached(kv, "b", reply(2));
  assert.equal(getCached(kv, "a")?.marks, 1); assert.equal(getCached(kv, "b")?.marks, 2); assert.equal(getCached(kv, "c"), null);
});
test("marking the same answer again replaces the old entry and does not grow the list", () => {
  const kv = store(); putCached(kv, "a", reply(1)); putCached(kv, "a", reply(2));
  assert.equal(getCached(kv, "a")?.marks, 2); assert.equal(JSON.parse(kv.raw.get(CACHE_KEY)!).length, 1);
});
test("it is bounded: the oldest go first", () => {
  const kv = store(); for (let i = 0; i < CACHE_MAX + 20; i++) putCached(kv, `k${i}`, reply(1));
  assert.equal(JSON.parse(kv.raw.get(CACHE_KEY)!).length, CACHE_MAX);
  assert.equal(getCached(kv, "k0"), null); assert.ok(getCached(kv, `k${CACHE_MAX + 19}`));
});
test("storage that is missing, full, blocked or holds rubbish never breaks marking", () => {
  assert.equal(getCached(null, "a"), null); putCached(null, "a", reply(1));
  const full: KV = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  putCached(full, "a", reply(1)); assert.equal(getCached(full, "a"), null);
  const rubbish: KV = { getItem: () => "{not json", setItem: () => {} };
  assert.equal(getCached(rubbish, "a"), null); putCached(rubbish, "a", reply(1));
  const odd: KV = { getItem: () => JSON.stringify([["a", 5], "x", ["b", null], ["c", reply(1)]]), setItem: () => {} };
  assert.equal(getCached(odd, "a"), null); assert.equal(getCached(odd, "c")?.marks, 1);
});
