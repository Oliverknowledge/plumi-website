import { test } from "node:test";
import assert from "node:assert/strict";
import { CONSENT_COPY, CONSENT_VERSION, giveConsent, hasConsent, SURFACE, withdrawConsent, type Rpc } from "./consent";

function rpc(reply: unknown, error: { message: string } | null = null): Rpc & { calls: [string, unknown][] } {
  const calls: [string, unknown][] = [];
  return { calls, rpc: async (name, args) => { calls.push([name, args]); return { data: reply, error }; } };
}

test("consent counts only when granted at this wording or newer", async () => {
  assert.equal(await hasConsent(rpc([{ granted: true, version: CONSENT_VERSION, age_band: "18_plus" }])), true);
  assert.equal(await hasConsent(rpc([{ granted: true, version: CONSENT_VERSION + 1 }])), true);
  assert.equal(await hasConsent(rpc([{ granted: true, version: CONSENT_VERSION - 1 }])), false);
  assert.equal(await hasConsent(rpc([{ granted: false, version: CONSENT_VERSION }])), false);
  assert.equal(await hasConsent(rpc([{ granted: true, version: null }])), false);
  assert.equal(await hasConsent(rpc([])), false);
  assert.equal(await hasConsent(rpc(null)), false);
  assert.equal(await hasConsent(rpc([{ granted: true, version: CONSENT_VERSION }], { message: "denied" })), false);
});
test("giving consent sends the surface, the version, the age band and the parent note", async () => {
  const r = rpc(null);
  assert.equal(await giveConsent(r, "18_plus", false), true);
  assert.deepEqual(r.calls[0], ["ai_consent_give", { p_surface: SURFACE, p_version: CONSENT_VERSION, p_age_band: "18_plus", p_parent_note_shown: false }]);
});
test("under 18 cannot be recorded without the parent note, and the call is not even made", async () => {
  const r = rpc(null);
  assert.equal(await giveConsent(r, "under_18", false), false);
  assert.equal(r.calls.length, 0);
  assert.equal(await giveConsent(r, "under_18", true), true);
  assert.equal(r.calls[0][0], "ai_consent_give");
});
test("a refused record is not consent", async () => { assert.equal(await giveConsent(rpc(null, { message: "no" }), "18_plus", false), false); });
test("withdrawing calls the withdraw function for this surface", async () => {
  const r = rpc(null); assert.equal(await withdrawConsent(r), true); assert.deepEqual(r.calls[0], ["ai_consent_withdraw", { p_surface: SURFACE }]);
});
test("the draft wording has no em dash and names where the answer goes", () => {
  const all = JSON.stringify(CONSENT_COPY);
  assert.ok(!all.includes("—")); assert.match(all, /DeepSeek/); assert.match(all, /China/);
});
