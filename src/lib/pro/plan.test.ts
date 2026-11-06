import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describePlan, plainDate } from "./plan";

const NOW = new Date("2026-11-06T12:00:00Z");
const pro = (expiresAt?: string, status: "active" | "grace" = "active") => ({ state: "pro" as const, expiresAt, status });

describe("what Settings says about the plan", () => {
  it("dates are plain and British: 14 Dec, with the year only when it is not this year", () => {
    assert.equal(plainDate("2026-12-14T09:00:00Z", NOW), "14 Dec");
    assert.equal(plainDate("2027-01-03T09:00:00Z", NOW), "3 Jan 2027");
    assert.equal(plainDate("2026-09-02T09:00:00Z", NOW), "2 Sep");
    assert.equal(plainDate("2026-12-31T23:30:00Z", NOW), "31 Dec", "London time");
    assert.equal(plainDate("soon", NOW), null);
    assert.equal(plainDate(undefined, NOW), null);
  });
  it("signed out: sign in to see it", () => {
    assert.deepEqual(describePlan({ state: "free", reason: "signed_out" }, { signedIn: false, loading: false }, NOW), { tone: "signedout", headline: "Sign in to see your plan" });
  });
  it("pro: says active until the date the record gives, and never claims it renews", () => {
    const l = describePlan(pro("2026-12-14T09:00:00Z"), { signedIn: true, loading: false }, NOW);
    assert.deepEqual(l, { tone: "pro", headline: "You have Plumi Pro", detail: "Active until 14 Dec" });
    assert.ok(!/renew/i.test(JSON.stringify(l)));
    assert.deepEqual(describePlan(pro(undefined), { signedIn: true, loading: false }, NOW), { tone: "pro", headline: "You have Plumi Pro" });
    assert.match(describePlan(pro("2026-11-05T09:00:00Z", "grace"), { signedIn: true, loading: false }, NOW).detail ?? "", /grace period after 5 Nov/);
  });
  it("free: a free plan, and when Pro ended if the record says", () => {
    assert.deepEqual(describePlan({ state: "free", reason: "none" }, { signedIn: true, loading: false }, NOW), { tone: "free", headline: "Free plan" });
    assert.deepEqual(describePlan({ state: "free", reason: "expired", expiresAt: "2026-10-01T00:00:00Z" }, { signedIn: true, loading: false }, NOW), { tone: "free", headline: "Free plan", detail: "Your Plumi Pro ended 1 Oct" });
    assert.equal(describePlan({ state: "free", reason: "revoked", expiresAt: "2026-10-01T00:00:00Z" }, { signedIn: true, loading: false }, NOW).detail, "Your Plumi Pro ended 1 Oct");
  });
  it("unknown: checking while it loads, 'couldn't check' after an error; never 'Free plan'", () => {
    assert.equal(describePlan({ state: "unknown" }, { signedIn: true, loading: true }, NOW).tone, "checking");
    const e = describePlan({ state: "unknown" }, { signedIn: true, loading: false }, NOW);
    assert.equal(e.tone, "later");
    assert.ok(!/free/i.test(e.headline));
  });
  it("no price, no buy words, no em dash anywhere a student reads", () => {
    const all = [describePlan({ state: "free", reason: "none" }, { signedIn: true, loading: false }), describePlan(pro("2026-12-14T09:00:00Z"), { signedIn: true, loading: false })].map((l) => `${l.headline} ${l.detail ?? ""}`).join(" ");
    assert.ok(!/[$£€]|price|cheap|buy|subscribe|—/i.test(all));
  });
});
