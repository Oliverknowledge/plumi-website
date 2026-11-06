/**
 * npm run sync:test
 *
 * The client: both calls asked for exactly as the contract names them, and every way they can go wrong turned into a value (never a throw), and the
 * only words a student can be shown.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSyncClient, failureFor, type RpcApi } from "./client";
import { SYNC_RPC } from "./contract";
import { COPY, OFF, lineFor, reduce, studentStrings, type Status } from "./status";

const client = (rpc: RpcApi["rpc"], timeout?: number) => createSyncClient({ rpc }, timeout);
const CHANGES = { decks: [], cards: [], tasks: [], task_done: [], flags: [] };
const PULL = { rev: 4, next: 4, more: false, decks: [], cards: [], tasks: [], task_done: [], flags: [] };
const PUSH = { rev: 4, applied: 0, conflicts: [], refused: [], rows: { decks: [], cards: [], tasks: [], task_done: [], flags: [] } };

describe("the calls", () => {
  it("push and pull use the contract's function and parameter names", async () => {
    const seen: { name: string; args: Record<string, unknown> }[] = [];
    const c = client(async (name, args) => { seen.push({ name, args }); return { data: name === "sync_push" ? PUSH : PULL, error: null }; });
    assert.ok((await c.push("web-device-a", CHANGES)).ok);
    assert.ok((await c.pull(7, 200)).ok);
    assert.deepEqual(seen.map((s) => s.name), [SYNC_RPC.push.name, SYNC_RPC.pull.name]);
    assert.deepEqual(Object.keys(seen[0].args), [...SYNC_RPC.push.args]);
    assert.deepEqual(Object.keys(seen[1].args), [...SYNC_RPC.pull.args]);
    assert.equal(seen[1].args.p_since, 7);
    assert.equal(seen[1].args.p_limit, 200);
  });

  it("an answer wrapped the way PostgREST wraps it (a list of one, JSON text, keyed by the function's name) is still read", async () => {
    for (const wrap of [(x: unknown) => [x], (x: unknown) => JSON.stringify(x), (x: unknown) => ({ sync_pull: x })]) {
      const r = await client(async () => ({ data: wrap(PULL), error: null })).pull(0, 10);
      assert.ok(r.ok, String(wrap));
    }
  });

  it("every failure is a value: network, 400, 403, 5xx, a missing function, an odd shape, a throw, a hang", async () => {
    const cases: [string, { message: string; code?: string; status?: number } | null, unknown, string][] = [
      ["network", { message: "Failed to fetch" }, null, "offline"],
      ["timeout inside", { message: "AbortError: The operation was aborted" }, null, "offline"],
      ["a bad request", { message: "sync:bad_request", code: "P0001", status: 400 }, null, "refused"],
      ["too many changes", { message: "sync:too_many_changes", code: "P0001", status: 400 }, null, "refused"],
      ["not signed in", { message: "sync:not_signed_in", code: "42501", status: 403 }, null, "signed_out"],
      ["an expired token", { message: "JWT expired", status: 401 }, null, "signed_out"],
      ["a busy server", { message: "upstream", status: 503 }, null, "offline"],
      ["rate limited", { message: "slow down", status: 429 }, null, "offline"],
      ["the migration is not applied", { message: "Could not find the function public.sync_pull", code: "PGRST202", status: 404 }, null, "unavailable"],
      ["an answer in a shape nobody expected", null, { surprise: true }, "refused"],
      ["no answer at all", null, null, "refused"],
      ["a number", null, 5, "refused"],
    ];
    for (const [label, error, data, want] of cases) {
      for (const call of ["push", "pull"] as const) {
        const c = client(async () => ({ data, error }));
        const r = call === "push" ? await c.push("web-device-a", CHANGES) : await c.pull(0, 10);
        assert.deepEqual(r.ok ? "ok" : r.failure, want, `${label} (${call})`);
      }
    }
    const thrower = client(async () => { throw new Error("socket hang up"); });
    assert.deepEqual(await thrower.pull(0, 1), { ok: false, failure: "offline" });
    const hang = client(() => new Promise(() => {}), 20);
    assert.deepEqual(await hang.push("web-device-a", CHANGES), { ok: false, failure: "offline" });
  });

  it("failureFor sorts the rest sensibly", () => {
    assert.equal(failureFor({ message: "weird", status: 418 }), "refused");
    assert.equal(failureFor({ message: "weird" }), "offline");
  });
});

describe("what a student can be shown", () => {
  const all = studentStrings();

  it("is three states, one calm note and two quiet lines", () => {
    assert.deepEqual([COPY.backed_up, COPY.backing_up, COPY.waiting, COPY.note], ["Backed up", "Backing up", "Waiting for a connection", "Some items aren't backed up yet"]);
    assert.equal(all.length, 7);
  });

  it("has no em dash or en dash anywhere, and none of the machinery's words", () => {
    for (const s of all) {
      assert.ok(!/[–—]/.test(s), `dash in: ${s}`);
      assert.ok(!/\b(error|errors|failed|failure|server|rpc|sync|synced|syncing|retry|conflict|tombstone|quota|refused)\b/i.test(s), `machinery word in: ${s}`);
      assert.ok(s.length <= 60, `short: ${s}`);
    }
  });

  it("any failure of any kind is 'Waiting for a connection' and nothing else", () => {
    let s: Status = reduce(OFF, { type: "enabled" });
    assert.equal(lineFor(s), "Backing up");
    s = reduce(s, { type: "failed" });
    assert.equal(lineFor(s), "Waiting for a connection");
    s = reduce(s, { type: "pending" });
    assert.equal(lineFor(s), "Backing up");
    s = reduce(s, { type: "done", notBackedUp: true });
    assert.deepEqual(s, { phase: "backed_up", note: true });
    s = reduce(s, { type: "done", notBackedUp: false });
    assert.deepEqual(s, { phase: "backed_up", note: false });
    assert.equal(reduce(OFF, { type: "done", notBackedUp: false }), OFF, "off stays off whatever arrives");
    assert.equal(reduce(OFF, { type: "failed" }), OFF);
    assert.equal(reduce(s, { type: "disabled" }), OFF);
    assert.equal(lineFor(OFF), null);
  });
});
