/**
 * Writes src/lib/social/chat.vectors.json from the app repo's tools/social-check/chat_test.sql: the
 * message vectors the server's `chat_refusal` is held to, with the answer each must get. The web's
 * chatRules.ts is tested against the same list (npm run social:test), as the iPad's ChatRules is.
 *
 *   npm run social:vectors                      reads ../plumi (the app checkout beside this one)
 *   PLUMI_APP_REPO=/path npm run social:vectors
 *   npm run social:vectors -- --check           fail if the committed file is not what the source gives
 *
 * The file is committed, so the tests run without the app repo; regenerate it when chat_test.sql changes.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const app = process.env.PLUMI_APP_REPO ?? resolve(__dirname, "../../plumi");
const source = resolve(app, "tools/social-check/chat_test.sql");
const out = resolve(__dirname, "../src/lib/social/chat.vectors.json");

/** A SQL string literal: 'it''s', or U&'\\FF46\\+01D41F' with \\XXXX and \\+XXXXXX escapes. */
function literal(expr: string): string | null {
  const plain = /^'((?:[^']|'')*)'$/.exec(expr);
  if (plain) return plain[1].replace(/''/g, "'");
  const uni = /^U&'((?:[^']|'')*)'$/.exec(expr);
  if (uni) {
    return uni[1].replace(/''/g, "'").replace(/\\(\\|\+[0-9A-Fa-f]{6}|[0-9A-Fa-f]{4})/g, (_, e: string) =>
      e === "\\" ? "\\" : String.fromCodePoint(parseInt(e.replace("+", ""), 16)));
  }
  return null;
}

/** A literal, or repeat(<literal>, n). */
function expression(expr: string): string | null {
  const rep = /^repeat\((.+),\s*(\d+)\)$/.exec(expr.trim());
  if (rep) { const unit = literal(rep[1].trim()); return unit === null ? null : unit.repeat(Number(rep[2])); }
  return literal(expr.trim());
}

const text = readFileSync(source, "utf8");
const vectors: { body: string; want: string | null }[] = [];
let inList = false;
for (const line of text.split("\n")) {
  if (/^INSERT INTO chat\.vector/.test(line)) inList = true;
  if (!inList) continue;
  if (/^\s*;/.test(line)) { inList = false; continue; }
  const m = /^\s*\((.*),\s*(NULL|'[a-z_]+')\)\s*,?\s*(--.*)?$/.exec(line);
  if (!m) continue;
  const body = expression(m[1]);
  if (body === null) throw new Error(`cannot read vector: ${line.trim()}`);
  vectors.push({ body, want: m[2] === "NULL" ? null : m[2].slice(1, -1) });
}
if (vectors.length < 60) throw new Error(`only ${vectors.length} vectors found in ${source}`);

const json = JSON.stringify({ source: "tools/social-check/chat_test.sql (app repo)", vectors }, null, 1) + "\n";

if (process.argv.includes("--check")) {
  if (!existsSync(source)) { console.log(`app repo not at ${app}: vectors not compared`); process.exit(0); }
  if (readFileSync(out, "utf8") !== json) { console.error("chat.vectors.json is out of date. Run: npm run social:vectors"); process.exit(1); }
  console.log(`chat.vectors.json matches chat_test.sql (${vectors.length} vectors)`);
} else {
  writeFileSync(out, json);
  console.log(`wrote ${vectors.length} vectors to ${out}`);
}
