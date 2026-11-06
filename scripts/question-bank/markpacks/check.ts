/**
 * Runs the deterministic gates over a folder of model readings and prints one line per part.
 *
 *   npx tsx scripts/question-bank/markpacks/check.ts <dir>
 *
 * <dir> holds `<partId>.json` readings, `_parts.json` (the bank rows: id, l, m) and `_ocr.json` (part id -> the bank's
 * text.json page text). extract.py writes all three. Exits 1 if any reading is rejected.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gatePack, type BankPartRef } from "./markpack";

const dir = resolve(process.argv[2] ?? ".");
const parts: BankPartRef[] = JSON.parse(readFileSync(join(dir, "_parts.json"), "utf8"));
const ocr: Record<string, string> = existsSync(join(dir, "_ocr.json")) ? JSON.parse(readFileSync(join(dir, "_ocr.json"), "utf8")) : {};
const tally: Record<string, number> = {};
for (const part of parts) {
  const file = join(dir, `${part.id}.json`);
  if (!existsSync(file)) { console.log(`${part.id.padEnd(20)} (no reading)`); continue; }
  const v = gatePack(JSON.parse(readFileSync(file, "utf8")), part, ocr[part.id]);
  tally[v.status] = (tally[v.status] ?? 0) + 1;
  console.log(`${part.id.padEnd(20)} ${String(part.m).padStart(2)}m  ${v.status.padEnd(8)} ${v.reasons.join("; ")}`);
}
console.log(JSON.stringify(tally));
process.exit((tally["rejected"] ?? 0) > 0 ? 1 : 0);
