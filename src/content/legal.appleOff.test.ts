import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { privacy } from "./legal";
import { appleSignInOn } from "@/lib/appleSignIn";

/** Switched off (the default), the policy must not claim a way in the website does not offer. */
describe("privacy policy with the Apple switch off", () => {
  test("the switch is off when unset", () => { assert.equal(process.env.NEXT_PUBLIC_APPLE_SIGNIN, undefined); assert.equal(appleSignInOn, false); });
  test("the website section lists Google, a code and a password, not Apple", () => {
    const s = privacy.sections.find((x) => x.heading === "The website")!;
    const first = s.blocks[0];
    const t = first.kind === "text" ? first.text : "";
    assert.match(t, /with Google, a code sent to your email, or an email and password/);
    assert.doesNotMatch(t, /Apple/);
  });
});
