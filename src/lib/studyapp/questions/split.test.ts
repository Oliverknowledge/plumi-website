import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cardEstimate } from "./virtual";
import { COL_NORMAL, COL_WIDE, columnShare, pagePx, pinKind, questionPx, splitCardEstimate, unsplitWidth, zonePx } from "./split";

const tallPart = { w: 1086, h: 2039, m: 9 };       // a whole Further Maths question with its figure
const shortPart = { w: 1086, h: 285, m: 1 };       // a circle-your-answer line

describe("which questions are pinned", () => {
  const wide = { viewportW: 1280, viewportH: 800, zonePx: 100, was: null } as const;
  test("a tall question is split on a wide screen, a short one is left alone", () => {
    assert.equal(pinKind({ ...wide, questionPx: questionPx(tallPart, unsplitWidth(1150, 1280)) }), "split");
    assert.equal(pinKind({ ...wide, questionPx: questionPx(shortPart, unsplitWidth(1150, 1280)) }), null);
  });
  test("45% of the screen's height is the line, and a pinned question stays pinned a little below it", () => {
    assert.equal(pinKind({ ...wide, questionPx: 361, was: null }), "split");
    assert.equal(pinKind({ ...wide, questionPx: 359, was: null }), null);
    assert.equal(pinKind({ ...wide, questionPx: 300, was: "split" }), "split");
    assert.equal(pinKind({ ...wide, questionPx: 230, was: "split" }), null);
  });
  test("the setup picture and the shared figure count toward how tall the pinned side is", () => {
    const base = questionPx({ w: 1086, h: 300 }, 800);
    assert.ok(questionPx({ w: 1086, h: 300 }, 800, { stem: true }) > base + 250);
    assert.ok(questionPx({ w: 1086, h: 300 }, 800, { fig: { w: 1086, h: 700 } }) > base + 480);
  });
  test("a narrow screen gets the peek only when the question and the space under it do not fit", () => {
    const phone = { viewportW: 390, viewportH: 844, was: null } as const;
    assert.equal(pinKind({ ...phone, questionPx: 650, zonePx: 120 }), "peek");
    assert.equal(pinKind({ ...phone, questionPx: 100, zonePx: 140 }), null);
    assert.equal(pinKind({ ...phone, questionPx: 300, zonePx: 200 }), null);
    assert.equal(pinKind({ viewportW: 820, viewportH: 1180, questionPx: 900, zonePx: 300, was: null }), "peek");
  });
  test("a screen too short for either (a phone on its side) is left alone", () => {
    assert.equal(pinKind({ viewportW: 932, viewportH: 430, questionPx: 900, zonePx: 100, was: null }), null);
  });
  test("the working page is about a screen, and the columns have two widths", () => {
    assert.ok(pagePx(800) >= 800 && pagePx(800) <= 1100);
    assert.equal(pagePx(300), 560);
    assert.equal(columnShare(false), COL_NORMAL);
    assert.equal(columnShare(true), COL_WIDE);
    assert.ok(zonePx({ m: 4 }, undefined, 800) >= 140);
  });
});

describe("the guess for a card that has not been drawn", () => {
  test("a pinned card is guessed as about a screen and a bit, a card that is not pinned is as it was", () => {
    const folded = cardEstimate(tallPart as never, 1150);
    const same = cardEstimate(tallPart as never, 1150, false, false, false, undefined);
    assert.equal(folded, same);
    const pinned = cardEstimate(tallPart as never, 1150, false, false, false, { vw: 1280, vh: 800, stem: false, fig: null });
    assert.equal(pinned, splitCardEstimate(questionPx(tallPart, unsplitWidth(1150, 1280)), 800, false));
    assert.ok(pinned > 600 && pinned < 1300, String(pinned));
    // a short question stays what it was
    assert.equal(cardEstimate(shortPart as never, 1150, false, false, false, { vw: 1280, vh: 800, stem: false, fig: null }), cardEstimate(shortPart as never, 1150));
    // a narrow screen never guesses two columns
    assert.equal(cardEstimate(tallPart as never, 390, false, false, false, { vw: 390, vh: 844, stem: false, fig: null }), cardEstimate(tallPart as never, 390));
  });
});
