import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { draftKey } from "./mine";
import { artSlug, barLine, bookLabel, countAt, fallbackTilt, firstMissing, hasChoices, isMoreOpen, keptTier, levelHint, pileOf, TIER_HINT } from "./setupBooks";
import type { CatalogueSubject } from "./subject";

const c = (slug: string, board: string, level: string, subject: string): CatalogueSubject => ({ slug, title: slug, board, level, subject, count: 10 });
const CAT = [c("aqa-gcse-maths", "AQA", "GCSE", "Maths"), c("ocr-gcse-physics-a", "OCR", "GCSE", "Physics A"), c("aqa-a-level-maths", "AQA", "A-Level", "Maths")];
const d = (...e: [string, string, string][]) => new Map(e.map(([l, b, s]) => [draftKey(l, b), s] as [string, string]));

describe("setup books", () => {
  test("a book's art is found by the subject's slug", () => {
    assert.equal(artSlug("Combined Science"), "combined-science");
    assert.equal(artSlug("Maths"), "maths");
    assert.equal(artSlug("Law & Order"), "law-and-order");
  });
  test("screen reader names say whether the book is chosen and which board", () => {
    assert.equal(bookLabel("Maths", false, null), "Maths, not chosen");
    assert.equal(bookLabel("Maths", false, "AQA"), "Maths, not chosen");
    assert.equal(bookLabel("Maths", true, "AQA"), "Maths, AQA, chosen");
    assert.equal(bookLabel("Maths", true, "AQA", ["Higher"]), "Maths, AQA, Higher, chosen");
    assert.equal(bookLabel("Maths", true, null), "Maths, chosen, pick a board");
    assert.equal(bookLabel("Maths", true, "AQA", [], true), "Maths, AQA, pick a tier, chosen");
    assert.equal(bookLabel("Maths", false, "AQA", [], true), "Maths, not chosen");
    assert.equal(bookLabel("Maths", true, null, [], true), "Maths, chosen, pick a board");
  });
  test("a fallback tilt is the same every time, never flat and never wild", () => {
    for (const s of ["maths", "law", "sociology", "x", "religious-studies", "a-very-long-subject-name"]) {
      const t = fallbackTilt(s);
      assert.equal(t, fallbackTilt(s));
      assert.ok(Math.abs(t) >= 0.8 && Math.abs(t) <= 2.6, `${s}: ${t}`);
    }
    assert.ok(new Set(["law", "politics", "philosophy", "sociology", "business"].map(fallbackTilt)).size > 2);
  });
  test("the pile is the ticked books in the order ticked, with their boards", () => {
    const p = pileOf(d(["GCSE", "Physics", "ocr-gcse-physics-a"], ["GCSE", "Maths", ""], ["A-Level", "Maths", "aqa-a-level-maths"]), CAT);
    assert.deepEqual(p.map((b) => [b.level, b.base, b.board]), [["GCSE", "Physics", "OCR A"], ["GCSE", "Maths", null], ["A-Level", "Maths", "AQA"]]);
    assert.ok(p.every((b) => b.tint.startsWith("var(--t-")));
  });
  test("the bar asks about the missing board on screen first, and names the level only when it is elsewhere", () => {
    const draft = d(["GCSE", "Maths", ""], ["A-Level", "Maths", ""], ["GCSE", "Physics", "ocr-gcse-physics-a"]);
    assert.deepEqual(firstMissing(draft, "A-Level"), { level: "A-Level", base: "Maths" });
    assert.deepEqual(firstMissing(draft, "GCSE"), { level: "GCSE", base: "Maths" });
    assert.equal(barLine(draft, "GCSE").text, "Pick a board for Maths");
    assert.equal(barLine(d(["GCSE", "Maths", ""]), "A-Level").text, "Pick a board for GCSE Maths");
    assert.equal(barLine(draft, "GCSE").kind, "missing");
  });
  test("with every board chosen the bar names the books, and is quiet with none", () => {
    assert.equal(barLine(new Map(), "GCSE").kind, "none");
    assert.deepEqual(barLine(d(["GCSE", "Maths", "aqa-gcse-maths"]), "GCSE"), { kind: "ready", text: "Maths" });
    const five = d(["GCSE", "Maths", "x"], ["GCSE", "Physics", "x"], ["GCSE", "Biology", "x"], ["GCSE", "History", "x"], ["GCSE", "French", "x"]);
    assert.deepEqual(barLine(five, "GCSE"), { kind: "ready", text: "Maths, Physics and 3 more" });
  });
  test("a level's tab counts its own books, and a book has choices when there is more than one board or tier", () => {
    const draft = d(["GCSE", "Maths", ""], ["GCSE", "Physics", "x"], ["A-Level", "Maths", "x"]);
    assert.equal(countAt(draft, "GCSE"), 2);
    assert.equal(countAt(draft, "A-Level"), 1);
    assert.equal(countAt(draft, "IGCSE"), 0);
    assert.equal(hasChoices(1, 0), false);
    assert.equal(hasChoices(3, 0), true);
    assert.equal(hasChoices(1, 2), true);
  });
  test("More is open only while one of its levels is on screen", () => {
    assert.equal(isMoreOpen("GCSE", ["GCSE", "A-Level"], ["IGCSE"]), false);
    assert.equal(isMoreOpen("A-Level", ["GCSE", "A-Level"], ["IGCSE"]), false);
    assert.equal(isMoreOpen("IGCSE", ["GCSE", "A-Level"], ["IGCSE"]), true);
    assert.equal(isMoreOpen("GCSE", ["GCSE"], []), false);
  });
  test("a kept tiered subject starts with its tier, or any tier, never with a gap", () => {
    assert.deepEqual(keptTier(["Higher"], ["Higher", "Foundation"]), ["Higher"]);
    assert.deepEqual(keptTier([], ["Higher", "Foundation"]), ["Higher", "Foundation"]);
    assert.deepEqual(keptTier(undefined, ["Higher", "Foundation"]), ["Higher", "Foundation"]);
    assert.equal(keptTier(["Higher"], undefined), null);
    assert.equal(keptTier([], ["Core"]), null);
  });
  test("the other levels each carry a one-word hint, and a main level none", () => {
    for (const l of ["IGCSE", "International GCSE", "Level 1/2", "Level 2", "Level 3"]) assert.ok(levelHint(l), l);
    assert.notEqual(levelHint("IGCSE"), levelHint("International GCSE"));
    assert.equal(levelHint("GCSE"), null);
    assert.ok(!TIER_HINT.includes("\u2014"));
  });
});
