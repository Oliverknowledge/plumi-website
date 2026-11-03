import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { markKeyFor } from "./markKey";

describe("the mark scheme key", () => {
  test("maths gets M, A, B and the shorthand its schemes use; sciences allow and ignore; essay subjects the levels", () => {
    const maths = markKeyFor("aqa-gcse-maths");
    assert.deepEqual(maths.entries.slice(0, 3).map((e) => e.term), ["M", "A", "B"]);
    assert.ok(maths.entries.some((e) => e.term === "ft") && maths.entries.some((e) => e.term === "oe"));
    assert.equal(markKeyFor("edexcel-a-level-further-maths"), maths);
    assert.equal(markKeyFor("aqa-gcse-physics").summary, "What do allow and ignore mean?");
    assert.equal(markKeyFor("aqa-gcse-english-literature").summary, "What do the levels mean?");
  });
  test("every entry is short, and there is no em dash in anything a student reads", () => {
    for (const slug of ["aqa-gcse-maths", "aqa-gcse-physics", "aqa-gcse-history"]) {
      const k = markKeyFor(slug);
      assert.ok(!new RegExp(String.fromCharCode(0x2014)).test(JSON.stringify(k)));
      for (const e of k.entries) assert.ok(e.means.length <= 100 && e.term.length <= 20, e.term);
    }
  });
});
