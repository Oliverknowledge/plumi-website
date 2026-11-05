import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { clearPlumiKeys, confirmOk, deleteAccount, friendlyDeleteError, type DeleteDeps } from "./accountDelete";

const deps = (over: Partial<DeleteDeps> = {}) => {
  const calls: string[] = [];
  const d: DeleteDeps = {
    rpc: async () => { calls.push("rpc"); return { error: null }; },
    signOutLocal: async () => { calls.push("signOut"); },
    clearDevice: async () => { calls.push("clear"); },
    ...over,
  };
  return { d, calls };
};

describe("the confirm word", () => {
  test("DELETE in any case, spaces ignored; nothing else", () => {
    assert.ok(confirmOk("DELETE")); assert.ok(confirmOk("delete")); assert.ok(confirmOk("  Delete ")); 
    for (const t of ["", "dele", "deletee", "delete me", "yes", "DELET E"]) assert.ok(!confirmOk(t), t);
  });
  test("without it nothing is sent", async () => {
    const { d, calls } = deps();
    const r = await deleteAccount(d, { typed: "dele", clearDevice: true });
    assert.deepEqual(calls, []);
    assert.ok(!r.ok);
  });
});

describe("the flow", () => {
  test("success: the server, then sign out here; the device is left alone unless ticked", async () => {
    const { d, calls } = deps();
    assert.deepEqual(await deleteAccount(d, { typed: "DELETE", clearDevice: false }), { ok: true });
    assert.deepEqual(calls, ["rpc", "signOut"]);
  });
  test("success with the box ticked: the server, sign out, then clear this device", async () => {
    const { d, calls } = deps();
    assert.deepEqual(await deleteAccount(d, { typed: "delete", clearDevice: true }), { ok: true });
    assert.deepEqual(calls, ["rpc", "signOut", "clear"]);
  });
  test("a server error signs nobody out and clears nothing", async () => {
    const { d, calls } = deps({ rpc: async () => { calls.push("rpc"); return { error: { message: "permission denied for function delete_own_account", status: 500 } }; } });
    const r = await deleteAccount(d, { typed: "DELETE", clearDevice: true });
    assert.deepEqual(calls, ["rpc"]);
    assert.ok(!r.ok && !/delete_own_account|permission|rpc/i.test(r.message), r.ok ? "" : r.message);
  });
  test("no network (the call throws): the same, in plain words", async () => {
    const { d, calls } = deps({ rpc: async () => { throw new TypeError("Failed to fetch"); } });
    const r = await deleteAccount(d, { typed: "DELETE", clearDevice: true });
    assert.deepEqual(calls, []);
    assert.ok(!r.ok && /connection/i.test(r.message) && /nothing has been deleted/i.test(r.message));
  });
  test("once the server has said yes, a failing sign-out or clear never turns it into an error", async () => {
    const { d } = deps({ signOutLocal: async () => { throw new Error("x"); }, clearDevice: async () => { throw new Error("y"); } });
    assert.deepEqual(await deleteAccount(d, { typed: "DELETE", clearDevice: true }), { ok: true });
  });
});

describe("what a student is told", () => {
  test("an expired sign-in, no network, anything else", () => {
    assert.match(friendlyDeleteError({ status: 401 }), /sign-in has run out/);
    assert.match(friendlyDeleteError({ message: "JWT expired" }), /sign-in has run out/);
    assert.match(friendlyDeleteError({ message: "TypeError: Failed to fetch" }), /could not reach/);
    assert.match(friendlyDeleteError({ message: "boom", status: 500 }), /was not deleted/);
  });
  test("no em dash, no server words", () => {
    for (const e of [{ status: 401 }, { message: "fetch failed" }, { message: "boom" }]) assert.ok(!/—|rpc|gate|function|postgres|supabase/i.test(friendlyDeleteError(e)));
  });
});

describe("clearing this device", () => {
  const store = (keys: string[]) => {
    const m = new Map(keys.map((k) => [k, "1"]));
    return { m, s: { get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null, removeItem: (k: string) => { m.delete(k); } } };
  };
  test("Plumi's own keys go; the look, the dark mode and the ad choice stay; other sites' keys are not touched", () => {
    const { m, s } = store(["plumi-study-ink", "plumi-study-feed", "plumi-annot-mouse", "plumi-feed-open", "plumi.attribution.first", "plumi-theme", "plumi-look", "plumi-ad-consent", "other-key", "plumiish"]);
    const n = clearPlumiKeys(s);
    assert.equal(n, 5);
    assert.deepEqual([...m.keys()].sort(), ["other-key", "plumi-ad-consent", "plumi-look", "plumi-theme", "plumiish"]);
  });
});
