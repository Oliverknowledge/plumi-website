import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLocked, onTap, ProGate, readPro, RETRY_MS, WEB_DEVICE_ID, type RpcFn } from "./pro";

const real = { ready: true, userId: "u1", anonymous: false };
const row = (pro: boolean, reason = "ok") => ({ data: [{ pro, reason, expires_at: null, in_trial: false, status: null, devices: 1, device_limit: 3 }], error: null });
const gateWith = (rpc: RpcFn | null, clock = { t: 0 }) => ({ g: new ProGate(async () => rpc, () => clock.t), clock });

describe("the Pro gate", () => {
  it("reads the RPC's row: only an explicit pro true is Pro", () => {
    assert.equal(readPro([{ pro: true }]), true);
    assert.equal(readPro({ pro: true }), true);
    assert.equal(readPro([{ pro: false, reason: "device_limit" }]), false);
    assert.equal(readPro([]), null);
    assert.equal(readPro(null), null);
    assert.equal(readPro([{ pro: "yes" }]), null);
  });
  it("pro: asks as the one web device id, and says pro", async () => {
    const calls: unknown[][] = [];
    const { g } = gateWith(async (name, args) => { calls.push([name, args]); return row(true); });
    assert.equal(g.peek(real), "unknown", "unknown while it has not been asked: never shown as locked");
    assert.equal(await g.ask(real), "pro");
    assert.equal(g.peek(real), "pro");
    assert.deepEqual(calls, [["account_pro", { p_device_id: WEB_DEVICE_ID }]]);
    assert.match(WEB_DEVICE_ID, /^[A-Za-z0-9-]{8,64}$/);
  });
  it("free: a definitive no, kept for the visit (asked once)", async () => {
    let n = 0;
    const { g, clock } = gateWith(async () => { n++; return row(false, "none"); });
    assert.equal(await g.ask(real), "free");
    clock.t += 10 * RETRY_MS;
    assert.equal(await g.ask(real), "free");
    assert.equal(n, 1);
  });
  it("error: free (fail closed), quiet, and asked again after a minute", async () => {
    let n = 0;
    const answers: ({ data: unknown; error: unknown } | "throw")[] = [{ data: null, error: { message: "boom" } }, "throw", row(true)];
    const { g, clock } = gateWith(async () => { const a = answers[n++]; if (a === "throw") throw new Error("offline"); return a; });
    assert.equal(await g.ask(real), "free");
    assert.equal(g.peek(real), "free");
    assert.equal(await g.ask(real), "free");
    assert.equal(n, 1, "not hammered");
    clock.t += RETRY_MS + 1;
    assert.equal(await g.ask(real), "free");
    assert.equal(n, 2);
    clock.t += RETRY_MS + 1;
    assert.equal(await g.ask(real), "pro", "and it recovers");
    assert.equal(g.peek(real), "pro");
  });
  it("a malformed answer and an unconfigured project are both free, never an error", async () => {
    assert.equal(await gateWith(async () => ({ data: { nope: 1 }, error: null })).g.ask(real), "free");
    assert.equal(await gateWith(null).g.ask(real), "free");
  });
  it("unknown while loading, and one question for many askers", async () => {
    let release!: () => void;
    let n = 0;
    const { g } = gateWith(() => { n++; return new Promise((res) => { release = () => res(row(true)); }); });
    const a = g.ask(real), b = g.ask(real);
    assert.equal(g.peek(real), "unknown");
    await new Promise((r) => setTimeout(r, 0));
    release();
    assert.deepEqual(await Promise.all([a, b]), ["pro", "pro"]);
    assert.equal(n, 1);
  });
  it("signed out, anonymous and not-yet-checked: no question to the server", async () => {
    let n = 0;
    const { g } = gateWith(async () => { n++; return row(true); });
    assert.equal(g.peek({ ready: false, userId: null, anonymous: false }), "unknown");
    assert.equal(g.peek({ ready: true, userId: null, anonymous: false }), "free");
    assert.equal(g.peek({ ready: true, userId: "a", anonymous: true }), "free");
    assert.equal(await g.ask({ ready: true, userId: null, anonymous: false }), "free");
    assert.equal(await g.ask({ ready: true, userId: "a", anonymous: true }), "free");
    assert.equal(n, 0);
  });
  it("keeps each account's answer apart", async () => {
    const { g } = gateWith(async () => row(true));
    await g.ask(real);
    assert.equal(g.peek({ ready: true, userId: "u2", anonymous: false }), "unknown");
  });
  it("locks only with the switch on, only once free, and never the taster; an unknown answer waits", () => {
    assert.equal(isLocked(false, "free", false), false, "switch off: nothing is locked");
    assert.equal(isLocked(true, "unknown", false), false);
    assert.equal(isLocked(true, "pro", false), false);
    assert.equal(isLocked(true, "free", true), false);
    assert.equal(isLocked(true, "free", false), true);
    assert.equal(onTap(false, "free", false), "add");
    assert.equal(onTap(true, "free", true), "add");
    assert.equal(onTap(true, "pro", false), "add");
    assert.equal(onTap(true, "free", false), "locked");
    assert.equal(onTap(true, "unknown", false), "wait");
  });
});
