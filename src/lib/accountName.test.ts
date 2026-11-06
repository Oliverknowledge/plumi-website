import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { displayName } from "./accountName";

describe("the name shown for a signed-in student", () => {
  test("Google: full_name, then name", () => {
    assert.equal(displayName({ full_name: "Sam Okafor", name: "Sam" }), "Sam Okafor");
    assert.equal(displayName({ name: "Sam" }), "Sam");
  });
  test("Apple, first sign-in: a name in full_name or name, as a string or as parts", () => {
    assert.equal(displayName({ full_name: "  Amira Khan " }), "Amira Khan");
    assert.equal(displayName({ name: { firstName: "Amira", lastName: "Khan" } }), "Amira Khan");
    assert.equal(displayName({ name: { first_name: "Amira" } }), "Amira");
  });
  test("Apple, no name shared (hidden, or a later sign-in): null, so the caller falls back to the email", () => {
    assert.equal(displayName({ email: "x@privaterelay.appleid.com", iss: "https://appleid.apple.com", sub: "001" }), null);
    assert.equal(displayName({ full_name: "   ", name: "" }), null);
    assert.equal(displayName({ name: {} }), null);
    assert.equal(displayName({ full_name: 42, name: ["a"] }), null);
    assert.equal(displayName(undefined), null);
    assert.equal(displayName(null), null);
  });
});
