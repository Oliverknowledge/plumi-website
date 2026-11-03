import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createSet, EMPTY_QUESTIONS, markPart, setText, type QPart } from "./model";
import { workFileName, workHtml } from "./saveWork";

const part = (id: string, l: string, m: number | null): QPart => ({ id, p: "84631H", s: "JUN25", l, m, t: [], w: 1, h: 1 });
describe("save my work", () => {
  const r = createSet(EMPTY_QUESTIONS, { name: "June 2025 <Paper 1>, AQA GCSE Physics", subject: "s", title: "t", names: { JUN25: "June 2025", "84631H": "Paper 1 Higher" }, topics: {}, parts: [part("a", "01.1", 2), part("b", "01.2", 3), part("c", "02.1", 1)] }, 1);
  let d = setText(r.q, r.id, "a", "kinetic <b>energy</b>\nsecond line", 2).q;
  d = markPart(d, r.id, "a", 2, 3);
  const html = workHtml(d.sets[0], d.answers, { b: "data:image/png;base64,AAAA" }, new Date("2026-11-03T10:00:00Z"));
  test("typed answers, handwriting and the student's own marks are all in the page, and nothing is left unescaped", () => {
    assert.match(html, /kinetic &lt;b&gt;energy&lt;\/b&gt;<br>second line/);
    assert.match(html, /<img alt="Handwriting for 01\.2" src="data:image\/png;base64,AAAA">/);
    assert.match(html, /You gave yourself 2 out of 2\./);
    assert.match(html, /<h1>June 2025 &lt;Paper 1&gt;/);
    assert.ok(!html.includes("<b>energy"));
  });
  test("parts with nothing written are left out; an empty set says so", () => {
    assert.ok(!html.includes("02.1"));
    assert.match(workHtml(r.q.sets[0], r.q.answers, {}), /Nothing was written in this set\./);
  });
  test("the file name is safe", () => {
    assert.equal(workFileName({ name: "June 2025 Paper 1 Foundation, AQA GCSE Physics" }), "June-2025-Paper-1-Foundation-AQA-GCSE-Physics.html");
    assert.equal(workFileName({ name: "../../etc/passé" }), "etc-passe.html");
    assert.equal(workFileName({ name: "???" }), "my-work.html");
  });
});
