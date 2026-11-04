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

test("a question the student marked up is in the page with its marks on it, and nothing else about it changes", () => {
  const d = (() => { const set = { id: "s", name: "Mine", subject: "x", title: "X", names: {}, createdAt: 1, updatedAt: 1, at: 0, topics: {}, parts: [{ id: "p", p: "a", s: "b", l: "01.1", m: 2, t: [], w: 800, h: 300 }] }; return { sets: [set], answers: {}, recent: [] } as never as { sets: never[]; answers: Record<string, never> }; })();
  const html = workHtml(d.sets[0], d.answers, {}, new Date("2026-11-03T10:00:00Z"), { p: "data:image/png;base64,BBBB" });
  assert.match(html, /<img class="q" alt="The question 01\.1 with your marks on it" src="data:image\/png;base64,BBBB">/);
  assert.doesNotMatch(html, /Nothing was written/);
});

test("the saved page carries the handwriting face it is given, and a real handwriting fallback stack with ruled lines", () => {
  const r = createSet(EMPTY_QUESTIONS, { name: "n", subject: "s", title: "t", names: {}, topics: {}, parts: [part("a", "01.1", 1)] }, 1);
  const d = setText(r.q, r.id, "a", "an answer", 2).q;
  const html = workHtml(d.sets[0], d.answers, {}, new Date("2026-11-03T10:00:00Z"), {}, '@font-face{font-family:"Plumi Hand";src:url(data:font/woff2;base64,AAAA) format("woff2")}');
  assert.match(html, /<style>@font-face\{font-family:"Plumi Hand"/);
  assert.match(html, /\.t\{[^}]*font-family:"Plumi Hand",Caveat,"Bradley Hand",Noteworthy,"Segoe Print"[^}]*cursive[^}]*repeating-linear-gradient/);
  assert.ok(!workHtml(d.sets[0], d.answers, {}).includes("@font-face"));
});
