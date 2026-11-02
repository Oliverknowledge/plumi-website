/** npm run town:test: the place model (town or an interior): the transitions, the closed doors, the key the wire will carry. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLOSED, FADE_MS, initialPlace, interiorFor, parsePlaceKey, placeKey, stepPlace, type PlaceEvent, type PlaceState } from "./place";

const run = (s: PlaceState, ...ev: PlaceEvent[]) => { const fx: unknown[] = []; for (const e of ev) { const r = stepPlace(s, e); s = r.state; if (r.effect) fx.push(r.effect); } return { s, fx }; };

describe("the place model", () => {
  it("goes town -> fade out -> interior (mount) -> fade in -> idle through the library's door, and remembers the door", () => {
    const { s, fx } = run(initialPlace, { t: "door", id: "library", kind: "library" }, { t: "fade-done" }, { t: "fade-done" });
    assert.deepEqual(s.place, { kind: "interior", id: "library" });
    assert.equal(s.phase, "idle");
    assert.equal(s.door, "library");
    assert.deepEqual(fx, [{ t: "mount", id: "library" }]);
  });
  it("comes back out at the same door (restore) after exit, fade out, fade in", () => {
    const inside = run(initialPlace, { t: "door", id: "cafe", kind: "cafe" }, { t: "fade-done" }, { t: "fade-done" }).s;
    const out = run(inside, { t: "exit" }, { t: "fade-done" });
    assert.equal(out.s.place.kind, "town"); assert.equal(out.s.phase, "fadeIn");
    assert.deepEqual(out.fx, [{ t: "restore", door: "cafe" }]);
    assert.equal(run(out.s, { t: "fade-done" }).s.door, null);
  });
  it("answers the bakery, the bookshop and a cottage with 'Closed for now' and no transition", () => {
    for (const kind of ["bakery", "bookshop", "cottage"] as const) {
      const r = stepPlace(initialPlace, { t: "door", id: "x", kind });
      assert.deepEqual(r.effect, { t: "toast", text: CLOSED });
      assert.equal(r.state, initialPlace);
    }
    assert.equal(CLOSED, "Closed for now");
  });
  it("ignores doors and exits while a fade runs, and exits in the town", () => {
    const mid = stepPlace(initialPlace, { t: "door", id: "library", kind: "library" }).state;
    assert.equal(mid.phase, "fadeOut");
    assert.equal(stepPlace(mid, { t: "door", id: "cafe", kind: "cafe" }).state, mid);
    assert.equal(stepPlace(mid, { t: "exit" }).state, mid);
    assert.equal(stepPlace(initialPlace, { t: "exit" }).state, initialPlace);
    assert.equal(stepPlace(initialPlace, { t: "fade-done" }).state, initialPlace);
  });
  it("survives 10 enter and exit cycles ending where it began", () => {
    let s = initialPlace;
    for (let i = 0; i < 10; i++) s = run(s, { t: "door", id: i % 2 ? "cafe" : "library", kind: i % 2 ? "cafe" : "library" }, { t: "fade-done" }, { t: "fade-done" }, { t: "exit" }, { t: "fade-done" }, { t: "fade-done" }).s;
    assert.deepEqual(s, initialPlace);
  });
  it("names the place for the wire and reads it back", () => {
    assert.equal(placeKey({ kind: "town" }), "town");
    assert.equal(placeKey({ kind: "interior", id: "cafe" }), "in:cafe");
    assert.deepEqual(parsePlaceKey("in:library"), { kind: "interior", id: "library" });
    assert.equal(parsePlaceKey("in:nowhere"), null);
    assert.equal(interiorFor("bakery"), null);
    assert.equal(FADE_MS, 350);
  });
});
