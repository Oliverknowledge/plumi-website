import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { EMPTY, sanitise } from "../model";
import { createSet, EMPTY_QUESTIONS, keyOf, markPart, sanitiseQuestions, setInkMeta, setPrefs, setText, type QPart, type QuestionsData } from "./model";
import { QUESTIONS_KEY, questionsOfAppDocument, readIncoming, readQuestions, serialise, withoutQuestions } from "./persist";

const part = (id: string, l: string, m: number | null): QPart => ({ id, p: "84631H", s: "JUN25", l, m, t: ["4.1.1"], w: 1086, h: 300 });
const T0 = 1_700_000_000_000;
function worked(): QuestionsData {
  const q = createSet(EMPTY_QUESTIONS, { subject: "aqa-gcse-physics", title: "AQA GCSE Physics", names: { JUN25: "June 2025" }, topics: { "4.1.1": "Energy" }, parts: [part("a", "01.1", 2), part("b", "01.2", 3), part("c", "02.1", 1)] }, T0);
  const id = q.id;
  let d = q.q;
  d = setText(d, id, "a", "kinetic energy", T0).q;
  d = markPart(d, id, "a", 2, T0);
  d = setInkMeta(d, id, "b", 7, 2100, T0);
  d = setPrefs(d, { hand: true, keys: false, typeSize: "large", fingerScrolls: false });
  d = { ...d, pick: { subject: "aqa-gcse-physics", topics: ["4.1.1"] }, recent: [{ id: "a", at: T0 }] };
  return d;
}
/** The app's document as the version that shipped the Questions tab wrote it. */
const oldDocument = (q: QuestionsData) => JSON.stringify({ ...JSON.parse(JSON.stringify(EMPTY)), questions: q });

describe("the Questions data has its own key", () => {
  test("a record round trips through its own key unchanged", () => {
    const q = worked();
    const r = readQuestions(serialise(q), null);
    assert.equal(r.origin, "own");
    assert.equal(r.keep, null);
    assert.deepEqual(JSON.parse(JSON.stringify(r.data)), JSON.parse(JSON.stringify(q)));
  });
  test("the one-time migration is lossless: everything the app's document held, set for set and answer for answer", () => {
    const q = worked();
    const r = readQuestions(null, oldDocument(q));
    assert.equal(r.origin, "migrated");
    assert.deepEqual(JSON.parse(JSON.stringify(r.data)), JSON.parse(JSON.stringify(sanitiseQuestions(JSON.parse(JSON.stringify(q))))));
    assert.equal(r.data.sets.length, 1);
    assert.equal(r.data.answers[keyOf(q.sets[0].id, "a")].text, "kinetic energy");
    assert.equal(r.data.answers[keyOf(q.sets[0].id, "a")].got, 2);
    assert.equal(r.data.answers[keyOf(q.sets[0].id, "b")].ink?.n, 7);
    assert.equal(r.data.open, q.open);
    assert.equal(r.data.prefs.typeSize, "large");
    assert.deepEqual(r.data.recent, q.recent);
  });
  test("the app's document alone is migrated only until the new key exists; afterwards the new key wins", () => {
    const old = worked();
    const mine = setText(old, old.sets[0].id, "c", "newer, in the new key", T0 + 5).q;
    const r = readQuestions(serialise(mine), oldDocument(old));
    assert.equal(r.origin, "own");
    assert.equal(r.data.answers[keyOf(old.sets[0].id, "c")].text, "newer, in the new key");
  });
  test("a new student, or an app document without questions, reads as empty", () => {
    assert.equal(readQuestions(null, null).origin, "empty");
    assert.equal(readQuestions(null, JSON.stringify({ v: 1 })).origin, "empty");
    assert.equal(readQuestions(null, oldDocument(EMPTY_QUESTIONS)).origin, "empty");
    assert.equal(readQuestions(null, "not json").origin, "empty");
  });
  test("a corrupt or newer-version record does not crash the tab: it starts empty and hands back the raw text to keep", () => {
    for (const raw of ["{ torn", "null", "42", JSON.stringify({ v: 2, q: worked() }), JSON.stringify({ v: 1 }), JSON.stringify({ v: 1, q: "x" })]) {
      const r = readQuestions(raw, null);
      assert.equal(r.keep, raw, raw.slice(0, 30));
      assert.equal(r.data.sets.length, 0);
    }
  });
  test("an unreadable new key falls back to what the app's document still holds, and keeps the unreadable text", () => {
    const old = worked();
    const r = readQuestions("{ torn", oldDocument(old));
    assert.equal(r.origin, "migrated");
    assert.equal(r.keep, "{ torn");
    assert.equal(r.data.sets.length, 1);
  });
  test("another tab's write is read if it is readable, and ignored if not (this tab keeps what it has)", () => {
    const q = worked();
    assert.equal(readIncoming(serialise(q))?.sets.length, 1);
    assert.equal(readIncoming(null), null);
    assert.equal(readIncoming(""), null);
    assert.equal(readIncoming("{ torn"), null);
    assert.equal(readIncoming(JSON.stringify({ v: 9, q })), null);
  });
  test("hostile content is sanitised on the way in, as before", () => {
    const raw = JSON.stringify({ v: 1, q: { sets: [{ id: "__proto__", subject: "x", parts: [{ id: "p", p: "constructor", s: "s", l: "1", m: 1e9, t: [], w: 1, h: 1 }], names: { constructor: "x" } }], answers: { "__proto__/p": { at: 1, text: "z" } } } });
    const r = readQuestions(raw, null);
    assert.equal(r.origin, "own");
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    assert.ok(r.data.sets[0].parts[0].m! <= 200);
  });
  test("questionsOfAppDocument: only a document that really held questions is worth moving", () => {
    assert.equal(questionsOfAppDocument(null), null);
    assert.equal(questionsOfAppDocument("[]"), null);
    assert.equal(questionsOfAppDocument(JSON.stringify({ questions: 5 })), null);
    assert.equal(questionsOfAppDocument(oldDocument(worked()))?.sets.length, 1);
  });
});

describe("the app's document once the Questions data has left it", () => {
  test("it is written without them, and still reads back as a whole, empty questions section", () => {
    const doc = { ...JSON.parse(JSON.stringify(EMPTY)), questions: worked() };
    const out = withoutQuestions(doc);
    assert.equal(out.questions, EMPTY_QUESTIONS);
    const back = sanitise(JSON.parse(JSON.stringify(out)));
    assert.deepEqual(back.questions.sets, []);
    assert.equal(back.v, 1);
    // nothing else is touched
    assert.deepEqual({ ...out, questions: 0 }, { ...doc, questions: 0 });
    // already empty: the same object comes back
    assert.equal(withoutQuestions(EMPTY), EMPTY);
  });
  test("the key is its own", () => {
    assert.notEqual(QUESTIONS_KEY, "plumi-study-app");
  });
});
