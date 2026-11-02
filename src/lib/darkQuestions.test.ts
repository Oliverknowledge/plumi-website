import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_PIXELS, analyse, darkenCrop, renderDark, type Pixels, type Rect } from "./darkQuestions";

/** A crop on a small scale (543 px wide, half the bank's), drawn from rectangles, lines and rings: no files, no DOM. */
class Page implements Pixels {
  data: Uint8ClampedArray;
  constructor(public width: number, public height: number, paper = 255) {
    this.data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) { this.data[i * 4] = this.data[i * 4 + 1] = this.data[i * 4 + 2] = paper; this.data[i * 4 + 3] = 255; }
  }
  set(x: number, y: number, r: number, g = r, b = r) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
  }
  at(x: number, y: number) { const i = (y * this.width + x) * 4; return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]; }
  rect(x0: number, y0: number, w: number, h: number, r: number, g = r, b = r) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, r, g, b); }
  box(x0: number, y0: number, w: number, h: number, v = 0, t = 1) { this.rect(x0, y0, w, t, v); this.rect(x0, y0 + h - t, w, t, v); this.rect(x0, y0, t, h, v); this.rect(x0 + w - t, y0, t, h, v); }
  line(x0: number, y0: number, x1: number, y1: number, v = 0, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.rect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), t, t, v);
  }
  ring(cx: number, cy: number, r: number, v = 0) { for (let a = 0; a < 720; a++) this.set(Math.round(cx + r * Math.cos(a / 114.59)), Math.round(cy + r * Math.sin(a / 114.59)), v); }
  /** A line of print: words of glyph-sized blobs, 5 px wide and 9 high, with the gaps of real type. Returns its extent. */
  words(x: number, y: number, n: number): Rect {
    let cx = x;
    for (let w = 0; w < n; w++) {
      for (let g = 0; g < 4 + (w % 3); g++) { this.rect(cx, y + (g % 2), 4, 9 - (g % 2), 20); cx += 6; }
      cx += 6;
    }
    return { x, y, w: cx - x - 12, h: 10 };
  }
}

const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const insideAny = (rs: Rect[], x: number, y: number) => rs.some(r => inside(r, x, y));

/** Print down the left, a figure in the middle (a diagonal, a ring, an axis), print under it. */
function question() {
  const p = new Page(543, 420);
  const lines: Rect[] = [];
  for (let i = 0; i < 3; i++) lines.push(p.words(40, 14 + i * 16, 11));
  p.line(150, 120, 150, 260, 0, 2); p.line(150, 260, 400, 260, 0, 2);   // axes
  p.line(150, 250, 380, 130, 0, 2);                                     // a slanting line
  p.ring(300, 200, 40);                                                 // a ring
  p.words(120, 270, 3);                                                 // axis label, inside the figure
  for (let i = 0; i < 2; i++) lines.push(p.words(40, 330 + i * 16, 11));
  return { p, lines };
}

test("a blank page has no figures and goes wholly black", () => {
  const p = new Page(300, 200);
  const a = darkenCrop(p);
  assert.deepEqual(a.figures, []);
  for (let i = 0; i < p.data.length; i += 4) assert.deepEqual([p.data[i], p.data[i + 1], p.data[i + 2], p.data[i + 3]], [0, 0, 0, 255]);
});

test("print alone is turned to pure white on pure black", () => {
  const p = new Page(543, 200);
  p.words(40, 20, 12); p.words(40, 36, 12); p.rect(100, 120, 200, 2, 170); // two lines and a grey answer line
  const before = Array.from(p.data);
  const a = darkenCrop(p);
  assert.deepEqual(a.figures, []);
  assert.deepEqual(p.at(0, 0), [0, 0, 0, 255]);                 // paper is exactly black
  assert.deepEqual(p.at(41, 24), [255 - 20, 255 - 20, 255 - 20, 255]); // ink 20 is 235: near white
  assert.equal(before[(24 * 543 + 41) * 4], 20);
  assert.deepEqual(p.at(150, 120), [85, 85, 85, 255]);          // a grey rule inverts by its brightness
});

test("a figure is found and left exactly as printed, the print round it is turned over", () => {
  const { p, lines } = question();
  const before = new Uint8ClampedArray(p.data);
  const a = analyse(p);
  assert.equal(a.figures.length, 1);
  const f = a.figures[0];
  assert.ok(inside(f, 150, 120) && inside(f, 400, 260) && inside(f, 300, 160) && inside(f, 330, 270), "the whole drawing and its label are inside");
  for (const l of lines) for (const [x, y] of [[l.x, l.y], [l.x + l.w - 1, l.y + 9]]) assert.ok(!inside(f, x, y), "no print is inside the figure's box");
  renderDark(p, a.figures, a.paper);
  for (let y = f.y + 8; y < f.y + f.h - 8; y++) for (let x = f.x + 8; x < f.x + f.w - 8; x++) {
    const i = (y * p.width + x) * 4;
    assert.deepEqual([p.data[i], p.data[i + 1], p.data[i + 2]], [before[i], before[i + 1], before[i + 2]], `figure pixel ${x},${y} is as printed`);
  }
  assert.deepEqual(p.at(2, 2), [0, 0, 0, 255]);
  assert.deepEqual(p.at(lines[0].x + 1, lines[0].y + 4), [235, 235, 235, 255]);
});

test("the clean margin round a figure never reaches print beside or under it", () => {
  const p = new Page(543, 300);
  p.ring(200, 120, 40); p.line(160, 120, 240, 120, 0, 2); p.line(200, 80, 200, 160, 0, 2);
  const under = p.words(160, 168, 5);   // a caption 6 px under the ring's box
  const above = p.words(160, 60, 5);    // and 6 px above
  const a = analyse(p);
  assert.equal(a.figures.length, 1);
  const f = a.figures[0];
  for (const r of [under, above]) for (let x = r.x; x < r.x + r.w; x += 3) for (let y = r.y; y < r.y + r.h; y++) {
    const i = y * p.width + x;
    if (p.data[i * 4] < 100) assert.ok(!inside(f, x, y), "print stays outside the white box");
  }
});

test("a table, a ruled box and the boxes of a question number are print, not figures", () => {
  const p = new Page(543, 400);
  p.box(10, 10, 20, 17, 110); p.box(30, 10, 20, 17, 110); p.rect(15, 14, 4, 9, 0); p.rect(35, 14, 4, 9, 0);          // 0|1
  p.box(60, 10, 20, 17, 110);                                                                                        // 1
  // a table: 4 columns by 5 rows, text in the cells
  const cw = 70, rh = 20, x0 = 60, y0 = 80;
  for (let r = 0; r <= 5; r++) p.rect(x0, y0 + r * rh, cw * 4 + 1, 1, 90);
  for (let c = 0; c <= 4; c++) p.rect(x0 + c * cw, y0, 1, rh * 5 + 1, 90);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) p.words(x0 + c * cw + 10, y0 + r * rh + 5, 1);
  // shaded header
  p.rect(x0 + 1, y0 + 1, cw * 4 - 1, rh - 1, 217); for (let c = 0; c < 4; c++) p.words(x0 + c * cw + 10, y0 + 5, 1);
  p.box(60, 250, 300, 100, 120);                                                                                     // "Workings:" box
  assert.deepEqual(analyse(p).figures, []);
});

test("graph paper with a curve on it is a figure, not a table", () => {
  const p = new Page(543, 300);
  for (let x = 60; x <= 300; x += 6) p.rect(x, 40, 1, 200, 205);
  for (let y = 40; y <= 240; y += 6) p.rect(60, y, 241, 1, 205);
  for (let i = 0; i <= 200; i++) p.rect(60 + i, 240 - Math.round(150 * Math.sin((i / 200) * Math.PI)), 2, 2, 0);
  const a = analyse(p);
  assert.equal(a.figures.length, 1);
  assert.ok(inside(a.figures[0], 60, 40) && inside(a.figures[0], 300, 240) && inside(a.figures[0], 160, 90));
});

test("a table with a curve drawn across it is not a table either", () => {
  const p = new Page(543, 300);
  for (let r = 0; r <= 4; r++) p.rect(60, 40 + r * 50, 301, 1, 0);
  for (let c = 0; c <= 4; c++) p.rect(60 + c * 75, 40, 1, 201, 0);
  for (let i = 0; i <= 280; i++) p.rect(70 + i, 230 - Math.round(150 * Math.sin((i / 280) * Math.PI)), 2, 2, 0);
  assert.equal(analyse(p).figures.length, 1);
});

test("a coloured area, flat grey shading and a photograph are figures", () => {
  const p = new Page(543, 400);
  p.rect(40, 20, 70, 60, 214, 70, 70);                          // red
  p.rect(200, 20, 90, 70, 232);                                 // flat grey (a cliff)
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let y = 150; y < 250; y++) for (let x = 100; x < 220; x++) p.set(x, y, 40 + Math.floor(rnd() * 150));  // noise in mid-tones
  const a = analyse(p);
  assert.equal(a.figures.length, 3);
  assert.ok(insideAny(a.figures, 60, 40) && insideAny(a.figures, 240, 50) && insideAny(a.figures, 160, 200));
});

test("a short label touching a figure goes with it, a paragraph beside it does not", () => {
  const p = new Page(543, 300);
  p.ring(120, 120, 40); p.line(80, 120, 160, 120, 0, 2); p.line(120, 80, 120, 160, 0, 2);
  const label = p.words(168, 112, 2);          // a short label close to its right
  const para = p.words(40, 230, 14);           // a long line well below
  const a = analyse(p);
  assert.equal(a.figures.length, 1);
  assert.ok(inside(a.figures[0], label.x, label.y) && inside(a.figures[0], label.x + label.w - 1, label.y + 9), "label inside");
  assert.ok(!inside(a.figures[0], para.x + 4, para.y + 4), "paragraph outside");
});

test("an arrow or a dashed stroke among small marks is a figure; letters are not", () => {
  const p = new Page(543, 200);
  p.line(100, 60, 220, 62, 0, 1); p.line(220, 62, 212, 56, 0, 1); p.line(220, 62, 212, 68, 0, 1);   // an arrow, 60 px long
  assert.equal(analyse(p).figures.length, 1);
  const q = new Page(543, 200); q.words(40, 20, 6); q.words(40, 40, 7);
  assert.equal(analyse(q).figures.length, 0);
});

test("pictures left alone: already dark, huge, tiny", () => {
  const dark = new Page(300, 200, 30);
  assert.equal(darkenCrop(dark).skipped, "dark");
  assert.deepEqual(dark.at(10, 10), [30, 30, 30, 255]);
  const huge = { data: new Uint8ClampedArray(4), width: Math.ceil(Math.sqrt(MAX_PIXELS)) + 1, height: Math.ceil(Math.sqrt(MAX_PIXELS)) + 1 };
  assert.equal(analyse(huge).skipped, "huge");
  assert.equal(analyse(new Page(10, 10)).skipped, "tiny");
});

test("the paper's own level becomes exactly black even when it is not quite white", () => {
  const p = new Page(300, 100, 247);
  p.rect(20, 20, 6, 10, 0);
  darkenCrop(p);
  assert.deepEqual(p.at(5, 5), [0, 0, 0, 255]);
  assert.deepEqual(p.at(22, 25), [255, 255, 255, 255]);
});

test("colour outside a figure keeps its hue and has its lightness inverted", () => {
  const p = new Page(300, 100);
  p.rect(10, 10, 3, 3, 255, 0, 0);       // pure red: lightness 50% stays red
  p.rect(30, 10, 3, 3, 255, 200, 200);   // pale pink becomes a dark red
  renderDark(p, [], 255);
  assert.deepEqual(p.at(11, 11), [255, 0, 0, 255]);
  const [r, g, b] = p.at(31, 11);
  assert.ok(r > g && g === b && r < 120, `dark red, got ${r},${g},${b}`);
});

test("a figure's box has softly rounded corners and a transparent pixel counts as paper", () => {
  const p = new Page(200, 100, 255);
  p.data[(50 * 200 + 50) * 4 + 3] = 0; p.data[(50 * 200 + 50) * 4] = 0;
  renderDark(p, [{ x: 20, y: 20, w: 100, h: 60 }], 255);
  assert.deepEqual(p.at(20, 20), [0, 0, 0, 255]);        // the very corner is outside
  assert.deepEqual(p.at(70, 50), [255, 255, 255, 255]);  // inside, as printed
  assert.deepEqual(p.at(150, 50), [0, 0, 0, 255]);
  const q = new Page(100, 50); q.data[(10 * 100 + 10) * 4 + 3] = 0; q.data[(10 * 100 + 10) * 4] = 0;
  renderDark(q, [], 255);
  assert.deepEqual(q.at(10, 10), [0, 0, 0, 255]);
});

test("the same crop gives the same answer, with every box inside the picture", () => {
  const a = analyse(question().p), b = analyse(question().p);
  assert.deepEqual(a, b);
  for (const f of a.figures) assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.w <= 543 && f.y + f.h <= 420 && f.w > 0 && f.h > 0);
});

test("a crop a different width is read at the same proportions", () => {
  const p = new Page(1086, 800);
  // the same drawing at twice the size
  p.line(300, 240, 300, 520, 0, 4); p.line(300, 520, 800, 520, 0, 4); p.line(300, 500, 760, 260, 0, 4); p.ring(600, 400, 80);
  for (let i = 0; i < 4; i++) for (let g = 0; g < 22; g++) p.rect(80 + g * 12, 30 + i * 32, 8, 18, 20);
  const a = analyse(p);
  assert.equal(a.figures.length, 1);
  assert.ok(inside(a.figures[0], 300, 240) && inside(a.figures[0], 800, 520) && !inside(a.figures[0], 100, 40));
});
