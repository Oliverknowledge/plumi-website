import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { coverage, gatePack, packHash, parseExtraction, type BankPartRef } from "./markpack";

const D = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "pilot-v2");
const read = (f: string) => JSON.parse(readFileSync(join(D, f), "utf8"));
const parts: (BankPartRef & { s: string })[] = read("_parts.json");
const ocr: Record<string, string> = read("_ocr.json");
const fixture = (id: string) => read(`${id}.json`);
const partOf = (id: string): BankPartRef => parts.find((p) => p.id === id)!;
const gate = (id: string, raw: unknown = fixture(id)) => gatePack(raw, partOf(id), ocr[id]);

// ---------------------------------------------------------------------------------------
// Real extractions: AQA A-level Biology (7402), 20 parts read by a model from their question and scheme images on 6 Nov 2026
// ---------------------------------------------------------------------------------------

const EXPECTED: Record<string, string> = {
  "74011-nov20-05-2": "held", "74011-jun22-05-3": "ready", "74021-nov21-08-5": "ready", "74012-jun23-08-3": "held",
  "74023-jun24-03-4": "ready", "74011-jun16-04-3": "held", "74012-nov20-08-1": "held", "74012-jun24-02-4": "held",
  "74022-jun19-05-1": "ready", "74023-jun17-05-1": "ready", "74023-jun25-02-1": "held", "74021-nov21-06-1": "held",
  "74022-jun23-02-3": "held", "74012-jun22-02-3": "ready", "74021-jun23-08-2": "ready", "74012-jun17-07-2": "held",
  "74022-nov21-02-2": "ready", "74011-nov20-07-1": "ready", "74022-jun18-07-3": "ready", "74022-spec-09-2": "ready",
};

for (const [id, status] of Object.entries(EXPECTED)) {
  test(`real reading ${id} (${partOf(id).m} mark${partOf(id).m === 1 ? "" : "s"}): ${status}`, () => {
    assert.equal(gate(id).status, status, gate(id).reasons.join("; "));
  });
}

test("the pilot as a whole: 11 ready, 9 held, none rejected", () => {
  const counts: Record<string, number> = {};
  for (const id of Object.keys(EXPECTED)) counts[gate(id).status] = (counts[gate(id).status] ?? 0) + 1;
  assert.deepEqual(counts, { ready: 11, held: 9 });
});

test("held parts say why, in plain terms", () => {
  assert.deepEqual(gate("74011-nov20-05-2").reasons, ["needs a figure or table"]);
  assert.deepEqual(gate("74022-jun23-02-3").reasons, ["answer kind is numeric"]);
});

test("a real comment is scoped to its mark point, and 'ignore X but reject Y' is two items", () => {
  const v = gate("74022-jun19-05-1");
  assert.equal(v.status, "ready");
  if (v.status !== "ready") return;
  assert.deepEqual(v.pack.reject.map((r) => [r.point, r.text]).sort(), [[1, "produces enzymes"], [2, "glucagon converts"], [2, "glycogen"], [2, "occurs in pancreas"]].sort());
  assert.deepEqual(v.pack.ignore.map((r) => [r.point, r.text]), [[2, "lipids/fats/proteins"]]);
});

test("an 'OR' scheme worth one mark keeps every alternative and caps the marks (max_marks), and passes", () => {
  const v = gate("74021-nov21-08-5");
  assert.equal(v.status, "ready");
  if (v.status === "ready") { assert.equal(v.pack.max_marks, 1); assert.equal(v.pack.points.length, 3); }
});

// ---------------------------------------------------------------------------------------
// Crafted bad readings: each gate refuses what it is for
// ---------------------------------------------------------------------------------------

const GOOD = "74023-jun17-05-1";
const mutate = (f: (d: Record<string, any>) => void, id = GOOD) => { const d = structuredClone(fixture(id)); f(d); return gate(id, d); };
const rejectedFor = (v: ReturnType<typeof gate>, needle: string) => { assert.equal(v.status, "rejected"); assert.ok(v.reasons.some((r) => r.includes(needle)), v.reasons.join("; ")); };

test("the unchanged good reading passes", () => assert.equal(gate(GOOD).status, "ready"));
test("IDENTITY: a scheme image of another question is refused", () => rejectedFor(mutate((d) => { d.scheme_label = "05.2"; }), "scheme image says"));
test("IDENTITY: a question image of another question is refused", () => rejectedFor(mutate((d) => { d.question_label = "06.1"; }), "question image says"));
test("labels compare ignoring punctuation and case", () => assert.equal(mutate((d) => { d.question_label = "05 . 1"; d.scheme_label = "05.1"; }).status, "ready"));
test("marks printed that disagree with the bank are refused", () => rejectedFor(mutate((d) => { d.marks_printed = 3; }), "marks printed"));
test("a scheme total that disagrees with the bank is refused", () => rejectedFor(mutate((d) => { d.scheme_total = 1; }), "scheme total"));
test("point marks that do not add up are refused", () => rejectedFor(mutate((d) => { d.points[0].marks = 2; }), "add up"));
test("max_marks that disagrees with the bank is refused", () => rejectedFor(mutate((d) => { d.max_marks = 5; }), "max marks"));
test("no mark points is refused", () => rejectedFor(mutate((d) => { d.points = []; }), "no mark points"));
test("two points with the same number are refused", () => rejectedFor(mutate((d) => { d.points[1].n = 1; }), "share a number"));
test("an empty point is refused", () => rejectedFor(mutate((d) => { d.points[0].text = "  "; }), "no words"));
test("INVENTED WORDS: a point the page does not say is refused", () => rejectedFor(mutate((d) => { d.points[0].text = "telomerase unwinding quokka"; }), "has words the page does not"));
test("INVENTED WORDS: an accept item the page does not say is refused", () => rejectedFor(mutate((d) => { d.accept.push({ point: null, text: "anything the student likes" }); }), "accept item"));
test("INVENTED WORDS: a reject item the page does not say is refused", () => rejectedFor(mutate((d) => { d.reject.push({ point: null, text: "mitochondria" }); }), "reject item"));
test("an accept item naming a point that does not exist is refused", () => rejectedFor(mutate((d) => { d.accept.push({ point: 9, text: "helicase" }); }), "point 9"));
test("a figure-dependent reading is held, not refused", () => assert.equal(mutate((d) => { d.needs_figure_or_table = true; }).status, "held"));
test("a reading that flags its own doubt is held for a person", () => assert.equal(mutate((d) => { d.issues = ["second line unreadable"]; }).status, "held"));
test("a numeric or levels scheme is held (not for the text marker)", () => {
  for (const kind of ["numeric", "levels", "choose_or_tick", "other"]) assert.equal(mutate((d) => { d.answer_kind = kind; }).status, "held", kind);
});
test("identity failures win over holds: a held reading of the wrong question is refused", () => rejectedFor(mutate((d) => { d.needs_figure_or_table = true; d.scheme_label = "09.9"; }), "scheme image says"));
test("a part the bank gives no marks is refused", () => assert.equal(gatePack(fixture(GOOD), { id: GOOD, l: "05.1", m: null }, ocr[GOOD]).status, "rejected"));

test("the OCR cross-check is skipped, not failed, when the page has no OCR text", () => {
  assert.equal(gatePack(fixture(GOOD), partOf(GOOD), undefined).status, "ready");
  assert.equal(gatePack(fixture(GOOD), partOf(GOOD), "").status, "ready");
});

// ---------------------------------------------------------------------------------------
// A model's JSON is never trusted: any shape error is a refusal, never an exception
// ---------------------------------------------------------------------------------------

test("malformed readings are refused without throwing", () => {
  const bad: unknown[] = [null, "text", 5, [], {}, { ...fixture(GOOD), points: "none" }, { ...fixture(GOOD), answer_kind: "poem" },
    { ...fixture(GOOD), marks_printed: "2" }, { ...fixture(GOOD), needs_figure_or_table: "no" },
    { ...fixture(GOOD), accept: [{ point: "one", text: "x" }] }, { ...fixture(GOOD), accept: [5] },
    { ...fixture(GOOD), points: [{ n: 1, text: 5, marks: 1 }] }, { ...fixture(GOOD), points: [{ n: 1, text: "x", marks: 999 }] },
    { ...fixture(GOOD), question_text: "x".repeat(5000) }, { ...fixture(GOOD), rules: new Array(100).fill("x") }];
  for (const b of bad) assert.equal(gatePack(b, partOf(GOOD), ocr[GOOD]).status, "rejected", JSON.stringify(b)?.slice(0, 60));
});

test("a reading cannot smuggle extra fields into the pack", () => {
  const d = { ...structuredClone(fixture(GOOD)), is_published: true, grant_everything: "yes" };
  const parsed = parseExtraction(d);
  assert.ok("pack" in parsed);
  if ("pack" in parsed) assert.deepEqual(Object.keys(parsed.pack).sort(), Object.keys(fixture(GOOD)).sort());
});

test("coverage counts words of three letters or more", () => {
  assert.equal(coverage("a of to", new Set()), 1);
  assert.equal(coverage("helicase polymerase", new Set(["helicase"])), 0.5);
});

// ---------------------------------------------------------------------------------------
// Identity of a pack
// ---------------------------------------------------------------------------------------

const SOURCES = { partId: GOOD, qpSha256: "a".repeat(64), msSha256: "b".repeat(64), cropVersion: 3 };
test("the hash is stable, and changes with the reading, either picture, or the crop version", async () => {
  const pack = (gate(GOOD) as { pack: any }).pack;
  const h = await packHash(pack, SOURCES);
  assert.equal(h.length, 64);
  assert.equal(await packHash(structuredClone(pack), SOURCES), h, "same");
  const reordered = Object.fromEntries(Object.entries(pack).reverse());
  assert.equal(await packHash(reordered as any, SOURCES), h, "key order does not matter");
  const changed = structuredClone(pack); changed.points[0].text += "!";
  assert.notEqual(await packHash(changed, SOURCES), h, "reading");
  assert.notEqual(await packHash(pack, { ...SOURCES, msSha256: "c".repeat(64) }), h, "scheme picture re-cut");
  assert.notEqual(await packHash(pack, { ...SOURCES, qpSha256: "c".repeat(64) }), h, "question picture re-cut");
  assert.notEqual(await packHash(pack, { ...SOURCES, cropVersion: 4 }), h, "crop version");
});
