import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerFromStatus, isLocked, onTap, ProGate, RETRY_MS, type ProAnswer } from "./pro";

const real = { ready: true, userId: "u1", anonymous: false };
const gateWith = (probe: () => Promise<ProAnswer>, clock = { t: 0 }) => ({ g: new ProGate(probe, () => clock.t), clock });

describe("the Pro gate on the screen (the real gate is the server's)", () => {
  it("reads /api/pro-status: 200 is Pro, 403 and 401 are not, anything else could not be told", () => {
    assert.equal(answerFromStatus(200), "pro");
    assert.equal(answerFromStatus(403), "free");
    assert.equal(answerFromStatus(401), "free");
    assert.equal(answerFromStatus(503), "error");
    assert.equal(answerFromStatus(500), "error");
    assert.equal(answerFromStatus(429), "error");
  });
  it("pro: unknown until asked, then pro", async () => {
    const { g } = gateWith(async () => "pro");
    assert.equal(g.peek(real), "unknown", "never shown locked while it is on its way");
    assert.equal(await g.ask(real), "pro");
    assert.equal(g.peek(real), "pro");
  });
  it("free: a definitive no, kept for the visit (asked once)", async () => {
    let n = 0;
    const { g, clock } = gateWith(async () => { n++; return "free"; });
    assert.equal(await g.ask(real), "free");
    clock.t += 10 * RETRY_MS;
    assert.equal(await g.ask(real), "free");
    assert.equal(n, 1);
  });
  it("error: free (fail closed), quiet, asked again after a minute, and it recovers", async () => {
    let n = 0;
    const answers: (ProAnswer | "throw")[] = ["error", "throw", "pro"];
    const { g, clock } = gateWith(async () => { const a = answers[n++]; if (a === "throw") throw new Error("offline"); return a; });
    assert.equal(await g.ask(real), "free");
    assert.equal(g.peek(real), "free");
    assert.equal(await g.ask(real), "free");
    assert.equal(n, 1, "not hammered");
    clock.t += RETRY_MS + 1;
    assert.equal(await g.ask(real), "free");
    assert.equal(n, 2);
    clock.t += RETRY_MS + 1;
    assert.equal(await g.ask(real), "pro");
    assert.equal(g.peek(real), "pro");
  });
  it("one question for many askers; each account's answer kept apart", async () => {
    let release!: () => void;
    let n = 0;
    const { g } = gateWith(() => { n++; return new Promise((res) => { release = () => res("pro"); }); });
    const a = g.ask(real), b = g.ask(real);
    assert.equal(g.peek(real), "unknown");
    await new Promise((r) => setTimeout(r, 0));
    release();
    assert.deepEqual(await Promise.all([a, b]), ["pro", "pro"]);
    assert.equal(n, 1);
    assert.equal(g.peek({ ready: true, userId: "u2", anonymous: false }), "unknown");
  });
  it("signed out, anonymous and not-yet-checked: no question to the server", async () => {
    let n = 0;
    const { g } = gateWith(async () => { n++; return "pro"; });
    assert.equal(g.peek({ ready: false, userId: null, anonymous: false }), "unknown");
    assert.equal(g.peek({ ready: true, userId: null, anonymous: false }), "free");
    assert.equal(g.peek({ ready: true, userId: "a", anonymous: true }), "free");
    assert.equal(await g.ask({ ready: true, userId: null, anonymous: false }), "free");
    assert.equal(await g.ask({ ready: true, userId: "a", anonymous: true }), "free");
    assert.equal(n, 0);
  });
  it("locks only once the student is known not to be Pro; an unknown answer waits", () => {
    assert.equal(isLocked("unknown"), false);
    assert.equal(isLocked("pro"), false);
    assert.equal(isLocked("free"), true);
    assert.equal(onTap("pro"), "open");
    assert.equal(onTap("free"), "locked");
    assert.equal(onTap("unknown"), "wait");
  });
});
