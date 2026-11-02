import assert from "node:assert/strict";
import { test } from "node:test";
import { isSitePath } from "./safePath";

test("ordinary paths on this site pass", () => {
  for (const p of ["/", "/library", "/study/library?x=1#top", "/question-bank/edexcel-a-level-maths/proof", "/sign-in?next=%2Flibrary"]) {
    assert.equal(isSitePath(p), true, p);
  }
});

test("paths that leave the site do not, in any spelling a browser would follow", () => {
  const bad = [
    "//evil.example", "/\\evil.example", "/\\\\evil.example", "/\t/evil.example", "/\n/evil.example", "/\r/evil.example",
    "/\u0000/evil.example", "https://evil.example", "http://evil.example/x", "javascript:alert(1)", "evil.example", "",
    "/%5Cevil.example".replace("%5C", "\\"), "/\u2028/evil.example", "/\u0085/evil.example",
  ];
  for (const p of bad) assert.equal(isSitePath(p), false, JSON.stringify(p));
  assert.equal(isSitePath(null), false);
  assert.equal(isSitePath(undefined), false);
  assert.equal(isSitePath("/" + "a".repeat(3000)), false);
});

test("a percent-encoded backslash is only dangerous after it is decoded, and the callers decode first", () => {
  assert.equal(isSitePath(decodeURIComponent("/%5Cevil.example")), false);
  assert.equal(isSitePath("/%5Cevil.example"), true); // still just a path segment named \evil.example until something decodes it
});
