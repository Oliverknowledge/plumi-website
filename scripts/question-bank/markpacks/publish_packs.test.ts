import { test } from "node:test";
import assert from "node:assert/strict";
import { dollarTag, publishSql, storedPack } from "./publish_packs";
import type { ExtractedPack } from "./markpack";

const pack = (): ExtractedPack => ({
  question_label: "08.3", scheme_label: "08.3", question_text: "Explain what 'rs' means; it's $pk0$ tricky", marks_printed: 1, scheme_total: 1, needs_figure_or_table: false,
  answer_kind: "points", points: [{ n: 1, text: "Strong negative correlation;", marks: 1 }], max_marks: null,
  accept: [], reject: [{ point: 1, text: "weak" }], ignore: [], rules: [], other_guidance: [], issues: ["private note"],
});

test("only what the marker uses is stored", () => {
  const s = storedPack(pack()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(s).sort(), ["accept", "ignore", "marks_printed", "max_marks", "other_guidance", "points", "question_text", "reject", "rules"]);
  assert.ok(!JSON.stringify(s).includes("private note"));
});
test("the dollar-quote tag never occurs in the payload", () => {
  assert.equal(dollarTag("abc"), "$pk0$");
  assert.equal(dollarTag("x $pk0$ y"), "$pk1$");
  assert.equal(dollarTag("$pk0$ $pk1$"), "$pk2$");
});
test("a payload that contains quotes and a dollar tag cannot break out of the literal", () => {
  const sql = publishSql("aqa-a-level-biology", "74021-jun25-08-3", pack(), "a".repeat(64), 3);
  assert.match(sql, /^SELECT public\.mark_pack_publish\(/);
  const tag = dollarTag(JSON.stringify(storedPack(pack())));
  assert.equal(tag, "$pk1$");
  assert.ok(sql.includes(`${tag}{`) && sql.includes(`}${tag}::jsonb`));
  assert.ok(sql.endsWith(`, '${"a".repeat(64)}', 1, 3);`));
});
