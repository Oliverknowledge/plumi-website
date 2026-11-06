import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStatus, ProStore, RETRY_MS, STALE_MS, type ProAnswer } from "./client";
import { applyOverrideQuery, OVERRIDE_KEY, readProOverride } from "./override";

const real = { ready: true, userId: "u1", anonymous: false };
const PRO: ProAnswer = { kind: "pro", expiresAt: "2026-12-14T09:00:00Z", status: "active" };
const UNK: ProAnswer = { kind: "unknown" };

/** A store with a fake probe, a fake clock and a fake timer. */
function make(answers: (ProAnswer | "throw")[] | (() => Promise<ProAnswer>)) {
  const clock = { t: 0 };
  const timers: { fn: () => void; at: number; live: boolean }[] = [];
  let calls = 0;
  const fresh: boolean[] = [];
  const probe = typeof answers === "function" ? async (f: boolean) => { calls++; fresh.push(f); return answers(); } : async (f: boolean) => { fresh.push(f); const a = answers[calls++]; if (a === "throw") throw new Error("offline"); return a; };
  const s = new ProStore(probe, { now: () => clock.t, later: (fn, ms) => { const t = { fn, at: clock.t + ms, live: true }; timers.push(t); return () => { t.live = false; }; } });
  s.subscribe(() => {});
  return { s, clock, calls: () => calls, fresh, timers, runTimers: () => { for (const t of timers.filter((x) => x.live && x.at <= clock.t)) { t.live = false; t.fn(); } } };
}

describe("reading /api/pro-status", () => {
  it("200 is Pro with its expiry; 403 is free with why; 401 is a token it would not take; the rest could not be told", () => {
    assert.deepEqual(parseStatus(200, { pro: true, expiresAt: "2026-12-14T09:00:00Z", status: "grace" }), { kind: "pro", expiresAt: "2026-12-14T09:00:00Z", status: "grace" });
    assert.deepEqual(parseStatus(200, null), { kind: "pro", expiresAt: undefined, status: "active" });
    assert.deepEqual(parseStatus(403, { error: "pro", reason: "expired", expiresAt: "2026-10-01T00:00:00Z" }), { kind: "free", reason: "expired", expiresAt: "2026-10-01T00:00:00Z" });
    assert.deepEqual(parseStatus(403, null), { kind: "free", reason: "none" });
    assert.deepEqual(parseStatus(401, {}), { kind: "free", reason: "bad_token" });
    for (const s of [429, 500, 503, 0]) assert.deepEqual(parseStatus(s, {}), { kind: "unknown" });
  });
});

describe("the shared Pro store", () => {
  it("unknown until asked, then pro; one request for many askers", async () => {
    let release!: (a: ProAnswer) => void;
    const m = make(() => new Promise((res) => { release = res; }));
    assert.equal(m.s.peek(real).state, "unknown");
    assert.equal(m.s.loading(real), true);
    const a = m.s.ask(real), b = m.s.ask(real), c = m.s.ask(real);
    await Promise.resolve();
    release(PRO);
    assert.deepEqual((await Promise.all([a, b, c])).map((p) => p.state), ["pro", "pro", "pro"]);
    assert.equal(m.calls(), 1, "ONE request shared");
    assert.equal(m.s.peek(real).state, "pro");
    assert.equal(m.s.loading(real), false);
    await m.s.ask(real);
    assert.equal(m.calls(), 1, "kept for the visit");
  });
  it("a free answer is free, with its reason; a Pro student's record carries its expiry", async () => {
    const m = make([{ kind: "free", reason: "expired", expiresAt: "2026-10-01T00:00:00Z" }]);
    assert.deepEqual(await m.s.ask(real), { state: "free", reason: "expired", expiresAt: "2026-10-01T00:00:00Z" });
    const p = make([PRO]);
    assert.deepEqual(await p.s.ask(real), { state: "pro", expiresAt: "2026-12-14T09:00:00Z", status: "active" });
  });
  it("an error is UNKNOWN, never free, and is asked again after 60 seconds, and recovers", async () => {
    const m = make([UNK, "throw", PRO]);
    assert.equal((await m.s.ask(real)).state, "unknown");
    assert.equal(m.s.peek(real).state, "unknown", "a Pro student is never shown a lock because of an error");
    assert.equal(m.timers.filter((t) => t.live).length, 1, "a retry is scheduled");
    m.clock.t += RETRY_MS; m.runTimers();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(m.calls(), 2);
    assert.equal(m.s.peek(real).state, "unknown", "a throw is also unknown");
    m.clock.t += RETRY_MS; m.runTimers();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(m.calls(), 3);
    assert.equal(m.s.peek(real).state, "pro");
    assert.equal(m.timers.filter((t) => t.live).length, 0, "no more retries once it has an answer");
  });
  it("signed out and anonymous are free at once and ask nothing; not-yet-checked is unknown", async () => {
    const m = make([PRO]);
    assert.deepEqual(m.s.peek({ ready: false, userId: null, anonymous: false }), { state: "unknown" });
    assert.deepEqual(m.s.peek({ ready: true, userId: null, anonymous: false }), { state: "free", reason: "signed_out" });
    assert.deepEqual(m.s.peek({ ready: true, userId: "a", anonymous: true }), { state: "free", reason: "anonymous" });
    assert.equal(m.s.loading({ ready: true, userId: null, anonymous: false }), false, "signed out is not loading: no flash");
    await m.s.ask({ ready: true, userId: null, anonymous: false });
    await m.s.ask({ ready: true, userId: "a", anonymous: true });
    assert.equal(m.calls(), 0);
  });
  it("another account's answer is kept apart (sign-out, sign-in as someone else)", async () => {
    const m = make([PRO]);
    await m.s.ask(real);
    assert.equal(m.s.peek({ ready: true, userId: "u2", anonymous: false }).state, "unknown");
    assert.equal(m.s.peek({ ready: true, userId: null, anonymous: false }).state, "free");
  });
  it("coming back to the tab after 5 minutes asks again quietly: the old answer stays until the new one lands", async () => {
    let n = 0;
    let release!: (a: ProAnswer) => void;
    const m = make(() => { n++; return n === 1 ? Promise.resolve(PRO) : new Promise((res) => { release = res; }); });
    await m.s.ask(real);
    m.clock.t += STALE_MS - 1; m.s.refreshIfStale(real);
    assert.equal(m.calls(), 1, "under 5 minutes: nothing");
    m.clock.t += 2; m.s.refreshIfStale(real);
    await Promise.resolve();
    assert.equal(m.calls(), 2);
    assert.equal(m.s.peek(real).state, "pro", "no flash while it asks");
    release({ kind: "free", reason: "expired" });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(m.s.peek(real).state, "free", "and it follows the new answer");
  });
  it("an error in a background check never throws away a real answer", async () => {
    const m = make([PRO, UNK]);
    await m.s.ask(real);
    m.clock.t += STALE_MS; m.s.refreshIfStale(real);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(m.calls(), 2);
    assert.equal(m.s.peek(real).state, "pro");
  });
  it("refresh asks again past every cache (Check again after a purchase)", async () => {
    const m = make([{ kind: "free", reason: "none" }, PRO]);
    assert.equal((await m.s.ask(real)).state, "free");
    assert.equal((await m.s.ask(real, { fresh: true })).state, "pro");
    assert.deepEqual(m.fresh, [false, true], "the second call asked the server to skip its cache too");
  });
  it("the version moves when an answer lands, so subscribers re-read", async () => {
    const m = make([PRO]);
    const v = m.s.version;
    await m.s.ask(real);
    assert.ok(m.s.version > v);
  });
});

describe("the test seam", () => {
  it("?pro=on or off, or the stored key, in a build that is not production", () => {
    assert.equal(readProOverride({ nodeEnv: "development", search: "?pro=on", stored: null }), "on");
    assert.equal(readProOverride({ nodeEnv: "development", search: "?pro=off", stored: "on" }), "off", "the URL wins");
    assert.equal(readProOverride({ nodeEnv: "test", search: "", stored: "on" }), "on");
    assert.equal(readProOverride({ nodeEnv: "development", search: "?pro=maybe", stored: "junk" }), null);
    assert.equal(readProOverride({ nodeEnv: undefined, search: "", stored: null }), null);
  });
  it("NEVER in a production build, whatever the URL or storage say", () => {
    assert.equal(readProOverride({ nodeEnv: "production", search: "?pro=on", stored: "on" }), null);
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    assert.equal(applyOverrideQuery("production", "?pro=on", storage), null);
    assert.equal(mem.size, 0, "it does not even write");
  });
  it("the query is remembered, and ?pro=clear forgets it", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    assert.equal(applyOverrideQuery("development", "?pro=on", storage), "on");
    assert.equal(mem.get(OVERRIDE_KEY), "on");
    assert.equal(applyOverrideQuery("development", "", storage), "on", "stays until cleared");
    assert.equal(applyOverrideQuery("development", "?pro=clear", storage), null);
  });
});
