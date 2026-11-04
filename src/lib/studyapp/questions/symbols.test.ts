import assert from "node:assert/strict";
import { test } from "node:test";
import { insertAt, SYMBOLS, toSub, toSup } from "./symbols";

test("superscripts and subscripts, and what cannot be converted stays", () => {
  assert.equal(toSup("2"), "²");
  assert.equal(toSup("-1"), "⁻¹");
  assert.equal(toSup("n+1"), "ⁿ⁺¹");
  assert.equal(toSup("q"), "q");
  assert.equal(toSub("H2O".slice(1, 2)), "₂");
  assert.equal(toSub("max"), "mₐₓ");
});
test("insertion replaces the selection and places the cursor after it", () => {
  assert.deepEqual(insertAt("v = 3", 4, 5, "√"), { value: "v = √", caret: 5 });
  assert.deepEqual(insertAt("ab", null, null, "π"), { value: "abπ", caret: 3 });
  assert.deepEqual(insertAt("ab", 1, 1, "²"), { value: "a²b", caret: 2 });
});
test("every symbol has a name a screen reader can say", () => {
  assert.ok(SYMBOLS.every((s) => s.ch && s.name));
  assert.equal(new Set(SYMBOLS.map((s) => s.ch)).size, SYMBOLS.length);
});

import { symbolsFor } from "./symbols";
const chars = (slug: string) => symbolsFor(slug).keys.map((k) => k.ch);

test("French and Spanish get their accents and punctuation, and no maths", () => {
  for (const c of ["é", "è", "ê", "ë", "à", "â", "ç", "î", "ï", "ô", "œ", "ù", "û", "«", "»"]) assert.ok(chars("aqa-gcse-french").includes(c), `French ${c}`);
  for (const c of ["á", "é", "í", "ó", "ú", "ü", "ñ", "¿", "¡", "«", "»"]) assert.ok(chars("aqa-a-level-spanish").includes(c), `Spanish ${c}`);
  for (const slug of ["aqa-gcse-french", "aqa-a-level-spanish", "aqa-gcse-bengali"]) {
    assert.ok(!chars(slug).includes("√") && !chars(slug).includes("π"), slug);
    assert.equal(symbolsFor(slug).script, false);
  }
  assert.ok(chars("aqa-gcse-bengali").includes("।"));
});
test("maths, the sciences and computing get the maths symbols and the superscript buttons", () => {
  for (const slug of ["aqa-gcse-maths", "edexcel-igcse-further-maths", "ocr-mei-a-level-maths", "aqa-gcse-combined-science", "ocr-gcse-combined-science-a", "aqa-a-level-physics", "ocr-a-level-chemistry-b", "ocr-a-level-biology-a", "edexcel-gcse-computer-science", "edexcel-gcse-additional-maths"]) {
    assert.ok(chars(slug).includes("√"), slug);
    assert.equal(symbolsFor(slug).script, true);
  }
});
test("English, History, Religious Studies and the other essay subjects get no strip at all", () => {
  for (const slug of ["aqa-gcse-english-language", "aqa-a-level-english-literature-a", "edexcel-a-level-history", "aqa-gcse-history", "aqa-gcse-religious-studies", "edexcel-gcse-religious-studies", "aqa-a-level-sociology", "aqa-a-level-politics", "aqa-a-level-philosophy", "aqa-a-level-law", "wjec-criminology", "aqa-gcse-islamic-studies"]) {
    assert.deepEqual(symbolsFor(slug), { keys: [], script: false }, slug);
  }
});
test("the subjects that count get a few numerals only", () => {
  assert.ok(chars("aqa-gcse-geography").includes("²"));
  assert.ok(!chars("aqa-gcse-geography").includes("√"));
  assert.equal(symbolsFor("aqa-gcse-economics").script, false);
});
test("a strip has no repeated key", () => {
  for (const slug of ["aqa-gcse-french", "aqa-gcse-spanish", "aqa-gcse-bengali", "aqa-gcse-maths", "aqa-gcse-geography"]) assert.equal(new Set(chars(slug)).size, chars(slug).length, slug);
});
