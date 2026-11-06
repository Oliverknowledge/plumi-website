import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addMistakeCards, EMPTY, mistakesKey, sanitise, type AppData } from "../model";
import { cleanCardPic, hasPictures, picUrl } from "../cardPics";
import { canShare, sharePayload } from "../sharing/payload";
import { collectMistakes, madeParts, mistakeCard, questionLabel } from "./mistakes";
import { EMPTY_QUESTIONS, keyOf, type QPart, type QSet, type QuestionsData } from "./model";

const part = (id: string, l: string, o: Partial<QPart> = {}): QPart => ({ id, p: "p1", s: "jun24", l, m: 3, t: ["4.1"], w: 600, h: 200, ms: 1, ...o });
const set = (id: string, subject: string, title: string, parts: QPart[], o: Partial<QSet> = {}): QSet => ({
  id, name: "Set", subject, title, names: { jun24: "June 2024", P1: "Paper 1" }, createdAt: 1, updatedAt: 1, parts, topics: { "4.1": "Forces" }, at: 0, ...o,
});
const qd = (sets: QSet[], answers: QuestionsData["answers"]): QuestionsData => ({ ...EMPTY_QUESTIONS, sets, answers });
const ans = (got: number | undefined, at: number, text?: string) => ({ got, at, ...(text ? { text } : {}) });

const A = part("84631h-jun24-04-2", "4(b)");
const B = part("84631h-jun24-05-1", "5(a)", { m: 1, ms: undefined, k: "C", t: ["4.2"] });
const S = set("s1", "aqa-gcse-physics", "AQA GCSE Physics", [A, B], { topics: { "4.1": "Forces", "4.2": "Energy" } });

describe("collecting the mistakes", () => {
  it("a part marked below its marks, with a scheme picture, is a mistake; full marks is not", () => {
    const q = qd([S], { [keyOf("s1", A.id)]: ans(1, 100), });
    const r = collectMistakes(q);
    assert.equal(r.total, 1);
    assert.deepEqual(r.groups[0].topics[0].mistakes[0], { part: A.id, set: "s1", label: "Q4(b)", from: "June 2024 Paper 1", got: 1, marks: 3, typed: false, at: 100, topic: { code: "4.1", title: "Forces" } });
    assert.equal(collectMistakes(qd([S], { [keyOf("s1", A.id)]: ans(3, 100) })).total, 0);
  });
  it("only what the student marked: an answer nobody marked is not here, and a mark of zero is", () => {
    assert.equal(collectMistakes(qd([S], { [keyOf("s1", A.id)]: { at: 1, text: "my answer" } })).total, 0);
    assert.equal(collectMistakes(qd([S], { [keyOf("s1", A.id)]: ans(0, 1) })).total, 1);
  });
  it("a part with no scheme picture and no answer letter, or no printed marks, is left out", () => {
    const noMs = part("x-jun24-01-1", "1(a)", { ms: undefined });
    const noMarks = part("x-jun24-02-1", "2(a)", { m: null });
    const zero = part("x-jun24-03-1", "3(a)", { m: 0 });
    const s = set("s2", "aqa-gcse-physics", "AQA GCSE Physics", [noMs, noMarks, zero]);
    assert.equal(collectMistakes(qd([s], { [keyOf("s2", noMs.id)]: ans(0, 1), [keyOf("s2", noMarks.id)]: ans(0, 1), [keyOf("s2", zero.id)]: ans(0, 1) })).total, 0);
  });
  it("a multiple-choice part counts, with its answer letter for the back", () => {
    const q = qd([S], { [keyOf("s1", B.id)]: ans(0, 5) });
    const r = collectMistakes(q);
    assert.equal(r.total, 1);
    const card = mistakeCard(q, r.groups[0].topics[0].mistakes[0])!;
    assert.match(card.back, /You gave yourself 0 of 1\nThe answer is C/);
    assert.equal(card.pic.b, undefined, "no scheme picture for a choice part");
  });
  it("one card a part: the latest mark wins across sets, and a redo to full marks takes it off", () => {
    const s2 = set("s2", "aqa-gcse-physics", "AQA GCSE Physics", [A]);
    const lost = collectMistakes(qd([S, s2], { [keyOf("s1", A.id)]: ans(1, 100), [keyOf("s2", A.id)]: ans(2, 200) }));
    assert.equal(lost.total, 1);
    assert.equal(lost.groups[0].topics[0].mistakes[0].got, 2, "the latest");
    assert.equal(collectMistakes(qd([S, s2], { [keyOf("s1", A.id)]: ans(1, 100), [keyOf("s2", A.id)]: ans(3, 200) })).total, 0, "redone right");
  });
  it("groups by subject then topic, most recent first", () => {
    const m = set("s3", "ocr-a-level-biology-a", "OCR A Level Biology A", [part("h420-jun24-01-1", "1(a)", { t: ["2.1"] })], { topics: { "2.1": "Cells" } });
    const q = qd([S, m], { [keyOf("s1", A.id)]: ans(1, 100), [keyOf("s1", B.id)]: ans(0, 300), [keyOf("s3", "h420-jun24-01-1")]: ans(0, 200) });
    const r = collectMistakes(q);
    assert.deepEqual(r.groups.map((g) => [g.subject, g.base, g.count]), [["aqa-gcse-physics", "Physics", 2], ["ocr-a-level-biology-a", "Biology", 1]]);
    assert.deepEqual(r.groups[0].topics.map((t) => t.title), ["Energy", "Forces"], "the topic of the newest mistake first");
  });
  it("a part already made into a card is skipped", () => {
    const q = qd([S], { [keyOf("s1", A.id)]: ans(1, 100) });
    assert.equal(collectMistakes(q, new Set([A.id])).total, 0);
    assert.deepEqual([...madeParts([{ pic: { part: A.id } }, {}])], [A.id]);
  });
  it("says whether they typed an answer", () => {
    const r = collectMistakes(qd([S], { [keyOf("s1", A.id)]: ans(1, 100, "because force") }));
    assert.equal(r.groups[0].topics[0].mistakes[0].typed, true);
  });
  it("labels read as printed", () => {
    assert.equal(questionLabel("01.4"), "Q01.4");
    assert.equal(questionLabel("3(b)(i)"), "Q3(b)(i)");
  });
});

describe("what a mistake becomes", () => {
  it("the question (its start, then the part) on the front; the scheme, the marks and their own answer on the back", () => {
    const stem = part("84631h-jun24-04-1", "4(a)", { st: 1, ms: undefined });
    const s = set("s1", "aqa-gcse-physics", "AQA GCSE Physics", [stem, A], { cv: 4 });
    const q = qd([s], { [keyOf("s1", A.id)]: ans(1, 100, "force times distance") });
    const m = collectMistakes(q).groups[0].topics[0].mistakes[0];
    const c = mistakeCard(q, m)!;
    assert.equal(c.front, "Q4(b) · June 2024 Paper 1");
    assert.deepEqual(c.pic.f?.map((p) => [p.k, p.id]), [["stem", stem.id], ["qp", A.id]]);
    assert.deepEqual(c.pic.b?.map((p) => [p.k, p.id, p.v]), [["ms", A.id, 4]]);
    assert.equal(c.pic.part, A.id);
    assert.equal(c.back, "You gave yourself 1 of 3\nYour answer: force times distance");
    assert.ok(picUrl(c.pic.b![0]).endsWith("-ms.webp?v=4"));
    assert.ok(picUrl(c.pic.f![0]).endsWith("-stem.webp?v=4"));
  });
  it("a part that shares another's stem points at it", () => {
    const shared = part("84631h-jun24-06-2", "6(b)", { sk: "84631h-jun24-06" });
    const s = set("s4", "aqa-gcse-physics", "AQA GCSE Physics", [shared]);
    const q = qd([s], { [keyOf("s4", shared.id)]: ans(0, 1) });
    const c = mistakeCard(q, collectMistakes(q).groups[0].topics[0].mistakes[0])!;
    assert.ok(picUrl(c.pic.f![0]).includes("84631h-jun24-06-stem.webp"));
  });
});

describe("picture cards in the model", () => {
  const S2 = (): { q: QuestionsData; cards: ReturnType<typeof makeCards> } => {
    const q = qd([S], { [keyOf("s1", A.id)]: ans(1, 100), [keyOf("s1", B.id)]: ans(0, 200) });
    return { q, cards: makeCards(q) };
  };
  function makeCards(q: QuestionsData) {
    return collectMistakes(q).groups.flatMap((g) => g.topics.flatMap((t) => t.mistakes)).map((m) => mistakeCard(q, m)!);
  }
  it("makes one deck for the subject, appends to it, and never adds a part twice", () => {
    const { cards } = S2();
    const r = addMistakeCards(EMPTY, "Physics", cards, 1000);
    assert.equal(r.added, 2);
    assert.equal(r.data.decks.length, 1);
    assert.equal(r.data.decks[0].title, "My mistakes · Physics");
    assert.equal(r.data.decks[0].subject, "Physics");
    assert.equal(r.data.decks[0].starter, mistakesKey("Physics"));
    assert.ok(r.data.cards.every((c) => c.pic?.part));
    const again = addMistakeCards(r.data, "Physics", cards, 2000);
    assert.equal(again.added, 0);
    assert.equal(again.data.cards.length, 2);
    assert.equal(again.deckId, r.deckId);
    const bio = addMistakeCards(r.data, "Biology", [{ ...cards[0], pic: { ...cards[0].pic, part: "h420-jun24-01-1" } }], 3000);
    assert.equal(bio.data.decks.length, 2, "another subject, another deck");
    assert.equal(addMistakeCards(r.data, "Biology", [cards[0]], 3000).added, 0, "a part is one card across every deck");
  });
  it("no deck is left behind when nothing was added", () => {
    assert.equal(addMistakeCards(EMPTY, "Physics", [], 1).data.decks.length, 0);
  });
  it("old records parse; a valid picture descriptor survives storage; a broken one is dropped", () => {
    const { cards } = S2();
    const made = addMistakeCards(EMPTY, "Physics", cards, 1000).data;
    const back = sanitise(JSON.parse(JSON.stringify(made)));
    assert.deepEqual(back.cards.map((c) => c.pic), made.cards.map((c) => c.pic));
    assert.ok(hasPictures(back.cards[0]));
    // an old save: no `pic` anywhere
    const old: AppData = { ...made, cards: made.cards.map(({ pic: _p, ...rest }) => { void _p; return rest; }) };
    const parsed = sanitise(JSON.parse(JSON.stringify(old)));
    assert.equal(parsed.cards.length, 2);
    assert.ok(parsed.cards.every((c) => !("pic" in c)));
    // a hand-edited bad descriptor becomes a plain card
    const bad = JSON.parse(JSON.stringify(made));
    bad.cards[0].pic = { part: "x", f: [{ id: "../../etc/passwd", k: "qp" }, { id: "ok-id-1", k: "nope" }] };
    const cleaned = sanitise(bad);
    assert.equal(cleaned.cards[0].pic?.f, undefined);
    assert.equal(cleanCardPic({ f: [{ id: "a b", k: "qp" }] }), undefined);
    assert.equal(cleanCardPic("junk"), undefined);
  });
  it("is never shared: the deck is marked ours, and a deck that holds a picture card is refused whatever its marker", () => {
    const { cards } = S2();
    const made = addMistakeCards(EMPTY, "Physics", cards, 1000).data;
    assert.equal(canShare(made.decks[0]), false);
    assert.equal(sharePayload(made, made.decks[0].id), null);
    // the same cards moved into a deck with no marker are still refused
    const unmarked: AppData = { ...made, decks: made.decks.map((d) => ({ ...d, starter: null })) };
    assert.equal(canShare(unmarked.decks[0]), true);
    assert.equal(sharePayload(unmarked, unmarked.decks[0].id), null, "the picture cards keep it from the server");
  });
});
