/**
 * Proves the Pro-only mark scheme cards are not in anything the website serves to everyone.
 *
 *     npm run build && npm run decks:leak-check
 *
 * For every card in src/content/proDecks it takes a distinctive run of plain words (at least 28 characters of letters, digits and spaces, from the longest
 * line of the card's ANSWER; fronts are past-paper questions the question bank already shows as text) and searches the build's public output for it: `.next/static` (the client chunks) and the study app's prerendered pages and flight data under
 * `.next/server/app/study*`, plus `public/`. Any hit is a leak and the check fails. A phrase that the free key wording decks also contain is left out (those are
 * public on purpose). Needs a finished `next build`. Reads and writes nothing else.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PRO = join(ROOT, "src", "content", "proDecks");
const FREE = ["biology", "chemistry", "physics"].map((s) => readFileSync(join(ROOT, "src", "content", "premadeDecks", `${s}.json`), "utf8")).join("\n");

const phrases = new Set<string>();
for (const f of readdirSync(PRO).filter((n) => n.startsWith("markscheme-"))) {
  const d = JSON.parse(readFileSync(join(PRO, f), "utf8")) as { cards: [string, string, string][] };
  for (const c of d.cards) {
    // The backs only: a card's front is a past-paper question, which the question bank already shows as text. The mark scheme answers are not public as text.
    for (const text of [c[2]]) {
      const runs = text.match(/[A-Za-z0-9 ,/'-]{28,}/g) ?? [];
      const best = runs.sort((a, b) => b.length - a.length)[0];
      if (best) { const p = best.trim().slice(0, 40); if (p.length >= 28 && !p.includes("'") && !FREE.includes(p)) phrases.add(p); }
    }
  }
}
phrases.add("Both travel at the same speed / speed of light/ 3.0");
// The question bank's prerendered pages carry exam text of their own, so only the study app's pages are searched under server/app.
const APP = join(ROOT, ".next", "server", "app");
const studyPages = existsSync(APP) ? readdirSync(APP).filter((n) => n === "study" || n.startsWith("study.")).map((n) => join(APP, n)) : [];
const dirs = [join(ROOT, ".next", "static"), ...studyPages, join(ROOT, "public")].filter(existsSync);
if (!existsSync(join(ROOT, ".next", "static"))) { console.error("No .next/static: run `npm run build` first."); process.exit(2); }

const dir = mkdtempSync(join(tmpdir(), "leak-"));
const list = join(dir, "phrases.txt");
writeFileSync(list, [...phrases].join("\n") + "\n");
let out = "";
try {
  out = execFileSync("grep", ["-rlF", "--include=*.js", "--include=*.html", "--include=*.rsc", "--include=*.json", "--include=*.txt", "--include=*.css", "--include=*.map", "-f", list, ...dirs], { encoding: "utf8", maxBuffer: 1 << 26 });
} catch (e) {
  const err = e as { status?: number; stdout?: string };
  if (err.status !== 1) throw e; // 1 = no match
  out = "";
}
const hits = out.split("\n").filter(Boolean);
if (hits.length) {
  console.error(`LEAK: mark scheme card text found in ${hits.length} public file(s):`);
  for (const h of hits.slice(0, 20)) console.error("  " + h.replace(ROOT + "/", ""));
  process.exit(1);
}
console.log(`ok: ${phrases.size} card phrases searched in ${dirs.map((d) => d.replace(ROOT + "/", "")).join(", ")}: none found.`);
