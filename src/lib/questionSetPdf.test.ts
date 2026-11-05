import assert from "node:assert/strict";
import { test } from "node:test";
import { hasAnswerLines, type Pixels } from "./questionSetPdf";

/** A crop on a white page, drawn from rectangles: no files, no DOM. */
function crop(height: number, boxes: [x0: number, y0: number, x1: number, y1: number][], width = 500): Pixels {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const [x0, y0, x1, y1] of boxes) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
  return { data, width, height };
}
const WORDS: [number, number, number, number] = [60, 10, 300, 30];
const rule = (y: number, x0 = 70, x1 = 500): [number, number, number, number] => [x0, y, x1, y + 2];

test("two lines at a crop's foot are lines to write on", () => {
  assert.equal(hasAnswerLines(crop(200, [WORDS, rule(100), rule(150)])), true);
});

test("three lines still count", () => {
  assert.equal(hasAnswerLines(crop(260, [WORDS, rule(100), rule(150), rule(200)])), true);
});

test("a box over a wider rule isn't two lines (Edexcel History's total)", () => {
  assert.equal(hasAnswerLines(crop(300, [WORDS, rule(200, 40, 480), rule(250, 5, 500)])), false);
});

test("a table's row isn't two lines: it has sides", () => {
  assert.equal(hasAnswerLines(crop(200, [WORDS, rule(100), rule(150), [70, 100, 72, 152], [498, 100, 500, 152]])), false);
});

test("two rules far above the foot aren't lines to write on", () => {
  assert.equal(hasAnswerLines(crop(400, [WORDS, rule(100), rule(150), [60, 300, 300, 320]])), false);
});

test("words on the left under the lines don't stop them counting", () => {
  assert.equal(hasAnswerLines(crop(220, [WORDS, rule(100), rule(150), [60, 170, 300, 185]])), true);
});
