import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRO_FEATURES, proFeature } from "./features";

describe("the Pro features list", () => {
  it("ids are stable, unique and kebab-case; every entry has a title and one short line", () => {
    assert.equal(new Set(PRO_FEATURES.map((f) => f.id)).size, PRO_FEATURES.length);
    for (const f of PRO_FEATURES) {
      assert.match(f.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      assert.ok(f.title.length > 2 && f.title.length <= 40, f.id);
      assert.ok(f.line.length > 5 && f.line.length <= 70, `${f.id}: one short line`);
      assert.ok(f.status === "live" || f.status === "soon");
    }
  });
  it("today's Pro feature is the mark scheme decks", () => {
    assert.equal(proFeature("mark-scheme-decks")?.status, "live");
    assert.equal(proFeature("nope"), undefined);
  });
  it("Angles (Topic analysis) is a live Pro feature", () => {
    assert.equal(proFeature("angles")?.status, "live");
    assert.equal(proFeature("angles")?.title, "Angles");
  });
  it("says nothing about price or buying (Pro is bought only in the iPad app), and has no em dash", () => {
    for (const f of PRO_FEATURES) assert.ok(!/[$£€]|price|cheap|buy|purchase|subscribe|—/i.test(`${f.title} ${f.line}`), f.id);
  });
});
