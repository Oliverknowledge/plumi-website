import assert from "node:assert/strict";
import { test } from "node:test";
import { earlierToRead, type BankPart } from "../content/questionBank";
import { hasAnswerLines, writingStarts, type Pixels } from "./questionSetPdf";

const part = (l: string, more: Partial<BankPart> = {}) => ({ id: l, p: "P1", s: "JUN25", l, m: 1, t: [], x: "", w: 100, h: 100, ...more }) as BankPart;
const q3 = ["03.1", "03.2", "03.3", "03.4"].map(l => part(l));
const ids = (ps: BankPart[]) => ps.map(p => p.l);

test("a later part alone gets the parts before it", () => {
  const read = earlierToRead([q3[2]], q3);
  assert.deepEqual(ids(read.get("03.3")!.parts), ["03.1", "03.2"]);
  assert.deepEqual(ids(read.get("03.3")!.needs), ["03.3"]);
});

test("a whole question gets nothing, in any order", () => {
  assert.equal(earlierToRead(q3, q3).size, 0);
  assert.equal(earlierToRead([...q3].reverse(), q3).size, 0);
});

test("each earlier part goes in once, above the first part that needs it", () => {
  const read = earlierToRead([q3[1], q3[3]], q3);
  assert.deepEqual(ids(read.get("03.2")!.parts), ["03.1"]);
  assert.deepEqual(ids(read.get("03.2")!.needs), ["03.2", "03.4"]);
  assert.deepEqual(ids(read.get("03.4")!.parts), ["03.3"]);
  assert.deepEqual(ids(read.get("03.4")!.needs), ["03.4"]);
});

test("a part picked later in the set isn't repeated above an earlier pick", () => {
  const read = earlierToRead([q3[2], q3[0]], q3);
  assert.deepEqual(ids(read.get("03.3")!.parts), ["03.2"]);
});

test("neither side of a choice is something to read", () => {
  const q = [part("1(a)"), part("1(b)", { or: 1 }), part("1(c)")];
  assert.equal(earlierToRead([q[1]], q).size, 0);
  assert.equal(earlierToRead([q[2]], q).size, 0);
});

test("10 sorts after 9", () => {
  const q = ["01.9", "01.10", "01.11"].map(l => part(l));
  assert.deepEqual(ids(earlierToRead([q[2]], [...q].reverse()).get("01.11")!.parts), ["01.9", "01.10"]);
});

/** A crop on a white page, drawn from rectangles: no files, no DOM. */
function crop(height: number, boxes: [x0: number, y0: number, x1: number, y1: number][], width = 500): Pixels {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const [x0, y0, x1, y1] of boxes) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
  return { data, width, height };
}
const WORDS: [number, number, number, number] = [60, 10, 300, 30];
const rule = (y: number, x0 = 70, x1 = 500): [number, number, number, number] => [x0, y, x1, y + 2];

test("two lines at a crop's foot are lines to write on, and it can stop above them", () => {
  const c = crop(200, [WORDS, rule(100), rule(150)]);
  assert.equal(hasAnswerLines(c), true);
  const top = writingStarts(c)!;
  assert.ok(top >= 30 && top <= 100, `cut at ${top}`);
});

test("three lines still count, and the cut is above the first", () => {
  const c = crop(260, [WORDS, rule(100), rule(150), rule(200)]);
  assert.equal(hasAnswerLines(c), true);
  assert.ok(writingStarts(c)! <= 100);
});

test("a label beside the first line stays out of what's kept", () => {
  const c = crop(200, [WORDS, [30, 90, 45, 102], rule(100), rule(150)]);
  assert.ok(writingStarts(c)! <= 90);
});

test("a label sitting just above the first line goes with it, and the words above stay", () => {
  const c = crop(200, [[60, 40, 300, 60], [30, 80, 45, 95], rule(100), rule(150)]);
  const top = writingStarts(c)!;
  assert.ok(top >= 60 && top <= 80, `cut at ${top}`);
});

test("a speck under the last line is the rule's edge, not words", () => {
  const c = crop(200, [WORDS, rule(100), rule(150), [68, 152, 70, 153]]);
  assert.ok(writingStarts(c)! <= 100);
});

test("a box over a wider rule isn't two lines (Edexcel History's total)", () => {
  const c = crop(300, [WORDS, rule(200, 40, 480), rule(250, 5, 500)]);
  assert.equal(hasAnswerLines(c), false);
  assert.equal(writingStarts(c), null);
});

test("a table's row isn't two lines: it has sides", () => {
  const c = crop(200, [WORDS, rule(100), rule(150), [70, 100, 72, 152], [498, 100, 500, 152]]);
  assert.equal(hasAnswerLines(c), false);
  assert.equal(writingStarts(c), null);
});

test("two rules far above the foot aren't lines to write on", () => {
  const c = crop(400, [WORDS, rule(100), rule(150), [60, 300, 300, 320]]);
  assert.equal(hasAnswerLines(c), false);
});

test("words on the left under the lines keep the crop whole, as they may set up the next part", () => {
  const c = crop(220, [WORDS, rule(100), rule(150), [60, 170, 300, 185]]);
  assert.equal(hasAnswerLines(c), true);
  assert.equal(writingStarts(c), null);
});

test("a mark on the right under the lines goes with them", () => {
  const c = crop(220, [WORDS, rule(100), rule(150), [460, 170, 495, 185]]);
  assert.ok(writingStarts(c)! <= 100);
});
