import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * The real questions store with a browser's storage stood in: days are recorded at the write path, with no page (no hook, no component) mounted. The globals must exist
 * before the store module is loaded, so it is imported after they are set.
 */
function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear() };
}
const local = memory();
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = local;
g.sessionStorage = memory();
g.window = { localStorage: local, sessionStorage: g.sessionStorage, addEventListener() { /* no other tabs here */ } };
g.document = { addEventListener() { /* nothing hidden here */ }, visibilityState: "visible" };

const D1 = Date.parse("2026-11-03T12:00:00Z"), D2 = Date.parse("2026-11-04T12:00:00Z"), D3 = Date.parse("2026-11-05T12:00:00Z");
const days = () => (JSON.parse(local.getItem("plumi-study-days") ?? "{\"days\":[]}") as { days: string[] }).days;

test("a typed answer written on day 1 and added to on day 2 leaves day 1 kept, and a mark on day 3 adds its day", async () => {
  const realNow = Date.now;
  try {
    const { qa, currentQuestions } = await import("./store");
    const part = { id: "q1a", p: "84631H", s: "JUN25", l: "01.1", m: 2, t: [], w: 1086, h: 300, ms: 1 as const };
    Date.now = () => D1;
    const id = qa.start({ subject: "aqa-gcse-physics", title: "AQA GCSE Physics", names: {}, topics: {}, parts: [part, { ...part, id: "q1b", l: "01.2", m: 1 }] });
    qa.text(id, "q1a", "Energy is transferred");
    assert.deepEqual(days(), ["2026-11-03"]);
    Date.now = () => D2;
    qa.text(id, "q1a", "Energy is transferred by heating");
    assert.equal(currentQuestions().answers[`${id}/q1a`].at, D2);
    assert.deepEqual(days(), ["2026-11-03", "2026-11-04"]);
    // A mark on a later day adds that day, and keeps the others.
    Date.now = () => D3;
    qa.mark(id, "q1b", 1);
    assert.deepEqual(days(), ["2026-11-03", "2026-11-04", "2026-11-05"]);
  } finally { Date.now = realNow; }
});
