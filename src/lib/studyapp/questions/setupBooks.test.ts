import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { draftKey } from "./mine";
import { artSlug, barLine, bookLabel, countAt, fallbackTilt, firstMissing, hasChoices, commonBoard, coverColour, isMoreOpen, tabColour, keptTier, levelHint, pileOf, TIER_HINT } from "./setupBooks";
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
    assert.ok(p.every((b) => /^#[0-9a-f]{6}$/.test(b.tint)));
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
    assert.deepEqual(barLine(five, "GCSE"), { kind: "ready", text: "Maths and 4 more" });
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
  test("every subject has its own cover colour, a real one, the same every time", () => {
    const subjects = ["Maths", "Further Maths", "Biology", "Chemistry", "Physics", "Combined Science", "Geography", "History", "English Language", "English Literature", "French", "Spanish", "Bengali", "Psychology", "Computer Science", "Business", "Economics", "Law", "Philosophy", "Politics", "Sociology", "Religious Studies"];
    const cols = subjects.map(coverColour);
    assert.equal(new Set(cols).size, subjects.length);
    assert.ok(cols.every((c) => /^#[0-9a-f]{6}$/.test(c)));
    assert.equal(coverColour("Islamic Studies"), coverColour("Islamic Studies"));
    assert.match(coverColour("Islamic Studies"), /^#[0-9a-f]{6}$/);
  });
  test("no two subjects' covers are near twins (CIELAB distance of 10 or more), and the feed's tab colour is the cover's", () => {
    const lab = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92));
      const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
      const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
    };
    const subjects = ["Maths", "Further Maths", "Biology", "Chemistry", "Physics", "Combined Science", "Geography", "History", "English Language", "English Literature", "French", "Spanish", "Bengali", "Psychology", "Computer Science", "Business", "Economics", "Law", "Philosophy", "Politics", "Sociology", "Religious Studies"];
    let min = 99;
    for (let i = 0; i < subjects.length; i++) for (let j = i + 1; j < subjects.length; j++) {
      const a = lab(coverColour(subjects[i])), b = lab(coverColour(subjects[j]));
      min = Math.min(min, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    }
    assert.ok(min >= 10, `closest pair is ${min.toFixed(1)}`);
    assert.equal(tabColour("Maths"), coverColour("Maths"));
  });
  test("a student who does not know their board gets the one with the most papers", () => {
    assert.deepEqual(commonBoard([{ l: "AQA", count: 900 }, { l: "Edexcel", count: 1200 }, { l: "OCR", count: 1200 }]), { l: "Edexcel", count: 1200 });
    assert.equal(commonBoard([]), undefined);
  });
});
