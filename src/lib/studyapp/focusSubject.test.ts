import assert from "node:assert/strict";
import { test } from "node:test";
import { levelFor, routeFor, wantedBase } from "./focusSubject";
import type { CatalogueSubject } from "./questions/subject";

const c = (slug: string, subject: string, board = "AQA", level = "GCSE"): CatalogueSubject => ({ slug, title: slug, board, level, subject, count: 100 });
const CAT = [
  c("aqa-gcse-physics", "Physics"), c("ocr-a-level-physics-a", "Physics A", "OCR", "A-Level"), c("aqa-gcse-maths", "Maths"), c("aqa-gcse-chemistry", "Chemistry"),
  c("aqa-gcse-combined-science", "Combined Science"), c("aqa-gcse-further-maths", "Further Maths"), c("aqa-gcse-biology", "Biology"),
];

test("one book of the subject: its feed", () => {
  assert.deepEqual(routeFor("physics", ["aqa-gcse-maths", "aqa-gcse-physics"], CAT), { kind: "feed", slug: "aqa-gcse-physics" });
  assert.deepEqual(routeFor("maths", ["aqa-gcse-physics", "aqa-gcse-maths"], CAT), { kind: "feed", slug: "aqa-gcse-maths" });
});
test("several books of the subject (two levels, two boards): the one used last, else the feed's own order, else the order they chose", () => {
  const mine = ["aqa-gcse-physics", "ocr-a-level-physics-a"];
  assert.deepEqual(routeFor("physics", mine, CAT, "ocr-a-level-physics-a"), { kind: "feed", slug: "ocr-a-level-physics-a" });
  assert.deepEqual(routeFor("physics", mine, CAT, null, ["ocr-a-level-physics-a", "aqa-gcse-physics"]), { kind: "feed", slug: "ocr-a-level-physics-a" });
  assert.deepEqual(routeFor("physics", mine, CAT), { kind: "feed", slug: "aqa-gcse-physics" });
  assert.deepEqual(routeFor("physics", mine, CAT, "aqa-gcse-maths", ["aqa-gcse-maths"]), { kind: "feed", slug: "aqa-gcse-physics" });
});
test("no book of the subject, but Combined Science: that is theirs for the three sciences", () => {
  for (const s of ["physics", "chemistry", "biology"]) assert.deepEqual(routeFor(s, ["aqa-gcse-combined-science", "aqa-gcse-maths"], CAT), { kind: "feed", slug: "aqa-gcse-combined-science" }, s);
  assert.deepEqual(routeFor("maths", ["aqa-gcse-combined-science"], CAT), { kind: "setup", base: "Maths" });
});
test("a book of the subject beats Combined Science", () => {
  assert.deepEqual(routeFor("biology", ["aqa-gcse-combined-science", "aqa-gcse-biology"], CAT), { kind: "feed", slug: "aqa-gcse-biology" });
});
test("Further Maths only: it is theirs for Maths", () => {
  assert.deepEqual(routeFor("maths", ["aqa-gcse-further-maths"], CAT), { kind: "feed", slug: "aqa-gcse-further-maths" });
});
test("none of their books fits: the setup, at that subject (the bank has it)", () => {
  assert.deepEqual(routeFor("chemistry", ["aqa-gcse-maths"], CAT), { kind: "setup", base: "Chemistry" });
  assert.deepEqual(routeFor("physics", [], CAT), { kind: "setup", base: "Physics" });
});
test("a subject the bank does not have, Other, or none chosen: no preference", () => {
  assert.deepEqual(routeFor("chemistry", ["aqa-gcse-maths"], CAT.filter((x) => x.subject !== "Chemistry")), { kind: "none" });
  assert.deepEqual(routeFor(null, ["aqa-gcse-maths"], CAT), { kind: "none" });
  assert.deepEqual(routeFor(undefined, ["aqa-gcse-maths"], CAT), { kind: "none" });
  assert.deepEqual(routeFor("history", ["aqa-gcse-maths"], CAT), { kind: "none" });
});
test("their slugs the bank no longer has are ignored, and a variant letter does not matter", () => {
  assert.deepEqual(routeFor("physics", ["gone", "ocr-a-level-physics-a"], CAT), { kind: "feed", slug: "ocr-a-level-physics-a" });
  assert.equal(wantedBase("physics"), "Physics"); assert.equal(wantedBase(null), null);
});

test("the setup shows the level that has the book: where it is if it can, else the first level that does", () => {
  const cat = [c("aqa-gcse-maths", "Maths"), c("ocr-a-level-physics-a", "Physics A", "OCR", "A-Level"), c("aqa-gcse-physics", "Physics")];
  assert.equal(levelFor("Physics", cat, "GCSE"), "GCSE");
  assert.equal(levelFor("Physics", cat, "A-Level"), "A-Level");
  assert.equal(levelFor("Maths", cat, "A-Level"), "GCSE");
  assert.equal(levelFor("Biology", cat, "A-Level"), "A-Level", "no such book anywhere: left where it was");
});
