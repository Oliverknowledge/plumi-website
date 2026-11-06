import assert from "node:assert/strict";
import { describe, test } from "node:test";
import "./legal.appleOn.env";
import { privacy } from "./legal";
import { appleSignInOn } from "@/lib/appleSignIn";

/** The privacy policy names the ways in that exist on the website; with the Apple switch on, Apple is one of them. */
const website = () => {
  const s = privacy.sections.find((x) => x.heading === "The website")!;
  const first = s.blocks[0];
  assert.equal(first.kind, "text");
  return first.kind === "text" ? first.text : "";
};
const whole = () => JSON.stringify(privacy);

describe("privacy policy and Sign in with Apple on the website", () => {
  test("the switch is read as on only for exactly 'on'", () => { assert.equal(appleSignInOn, true); });
  test("with the switch on, the website section names Apple, its shared name and email, and the relay address", () => {
    const t = website();
    assert.match(t, /with Apple \(which may share your name and email, or an Apple relay address if you hide your email\), Google, a code/);
  });
  test("what we collect already covers Apple's name and Hide My Email; Apple is listed as a service", () => {
    const all = whole();
    assert.match(all, /your name if Sign in with Apple shares it/);
    assert.match(all, /Hide My Email/);
    assert.match(all, /Apple \(the App Store, Sign in with Apple/);
  });
  test("no em dash in anything a student reads", () => { assert.doesNotMatch(whole(), /—/); });
});
