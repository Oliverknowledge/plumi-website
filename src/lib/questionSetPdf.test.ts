import assert from "node:assert/strict";
import { test } from "node:test";
import { hasAnswerLines, linesAtFoot, type Pixels } from "./questionSetPdf";

/** A crop on a white page, drawn from rectangles: no files, no DOM. */
function crop(height: number, boxes: [x0: number, y0: number, x1: number, y1: number][], width = 500): Pixels {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const [x0, y0, x1, y1] of boxes) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
  return { data, width, height };
}
const WORDS: [number, number, number, number] = [60, 10, 300, 30];
const rule = (y: number, x0 = 70, x1 = 500): [number, number, number, number] => [x0, y, x1, y + 2];
/** A line of words: letters too close together to tell from a dotted line, tall enough to have ink above its baseline. */
const words = (y: number, x0 = 60, x1 = 470): [number, number, number, number][] => Array.from({ length: Math.floor((x1 - x0) / 6) }, (_, i) => [x0 + i * 6, y, x0 + i * 6 + 3, y + 12]);
/** A dotted line, as OCR's and WJEC's are. */
const dots = (y: number, x0 = 70, x1 = 460): [number, number, number, number][] => Array.from({ length: Math.floor((x1 - x0) / 4) }, (_, i) => [x0 + i * 4, y, x0 + i * 4 + 2, y + 2]);

test("two lines at a crop's foot are lines to write on", () => {
  assert.equal(hasAnswerLines(crop(200, [WORDS, rule(100), rule(150)])), true);
});

test("three lines still count", () => {
  assert.equal(hasAnswerLines(crop(260, [WORDS, rule(100), rule(150), rule(200)])), true);
});

test("one line of a part's own is its answer space (AQA's 07.2, a 1-mark part that got two more)", () => {
  const c = crop(200, [WORDS, rule(150, 70, 490)]);
  assert.equal(linesAtFoot(c).length, 1);
  assert.equal(hasAnswerLines(c, 1), true);
  assert.equal(hasAnswerLines(c, 2), true);
});

test("one line isn't enough room for many marks: the crop stopped at the page's end", () => {
  const c = crop(200, [WORDS, rule(150, 70, 490)]);
  assert.equal(hasAnswerLines(c, 3), false);
  assert.equal(hasAnswerLines(c, 8), false);
});

test("two lines do for up to 3 marks, three or more for any", () => {
  const two = crop(200, [WORDS, rule(100, 70, 490), rule(150, 150, 490)]);
  assert.equal(hasAnswerLines(two, 3), true);
  assert.equal(hasAnswerLines(two, 4), false);
  const three = crop(300, [WORDS, rule(100, 70, 490), rule(170, 200, 490), rule(260, 70, 490)]);
  assert.equal(hasAnswerLines(three, 12), true);
});

test("a dotted line with its mark beside it counts (OCR's \"..... [2]\")", () => {
  const c = crop(120, [WORDS, ...dots(90), [465, 78, 468, 96], [472, 80, 480, 94], [484, 78, 487, 96]]);
  assert.equal(linesAtFoot(c).length, 1);
  assert.equal(hasAnswerLines(c, 2), true);
});

test("a labelled line counts, and two make room for a 2-mark part (\"Reason ____\")", () => {
  const c = crop(200, [WORDS, [70, 88, 150, 100], rule(100, 160, 490), [70, 138, 150, 150], rule(150, 160, 490)]);
  assert.equal(linesAtFoot(c).length, 2);
  assert.equal(hasAnswerLines(c, 2), true);
});

test("a question's last line of words isn't a line to write on", () => {
  const c = crop(100, [...words(20), ...words(50)]);
  assert.deepEqual(linesAtFoot(c), []);
  assert.equal(hasAnswerLines(c, 2), false);
});

test("the rule right under a question's total isn't a line to write on (Edexcel's)", () => {
  const c = crop(300, [WORDS, ...words(270, 280, 470), rule(284, 5, 500)]);
  assert.deepEqual(linesAtFoot(c), []);
  assert.equal(hasAnswerLines(c, 1), false);
});

test("a box's foot isn't a line to write on: its sides come down onto it (a poem in English Literature)", () => {
  const c = crop(300, [[60, 20, 62, 282], [438, 20, 440, 282], rule(20, 60, 440), rule(280, 60, 440), ...words(100, 80, 400)]);
  assert.deepEqual(linesAtFoot(c), []);
  assert.equal(hasAnswerLines(c, 1), false);
});

test("a table's row isn't two lines: it has sides", () => {
  const c = crop(200, [WORDS, rule(100), rule(150), [70, 100, 72, 152], [498, 100, 500, 152]]);
  assert.equal(hasAnswerLines(c, 2), false);
});

test("a box around a question's total, over a wider rule, leaves an essay its lines (Edexcel History's)", () => {
  const c = crop(300, [WORDS, rule(200, 40, 480), [40, 200, 42, 252], [478, 200, 480, 252], rule(250, 40, 480), ...words(220, 200, 460), rule(280, 5, 500)]);
  assert.equal(hasAnswerLines(c, 12), false);
});

test("two rules far above the foot aren't lines to write on", () => {
  assert.equal(hasAnswerLines(crop(400, [WORDS, rule(100), rule(150), [60, 300, 300, 320]])), false);
});

test("words on the left under a line mean it isn't at the foot", () => {
  const c = crop(220, [WORDS, rule(150), [60, 170, 300, 185]]);
  assert.deepEqual(linesAtFoot(c), []);
  assert.equal(hasAnswerLines(c, 1), false);
});

test("a mark or a total on the right under a line goes with it", () => {
  assert.equal(linesAtFoot(crop(220, [WORDS, rule(150), [460, 170, 495, 185]])).length, 1);
});

test("a crop with no lines at all gets the PDF's", () => {
  assert.equal(hasAnswerLines(crop(100, [WORDS]), 1), false);
});
