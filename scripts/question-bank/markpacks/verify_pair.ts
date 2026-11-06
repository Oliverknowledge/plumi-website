/**
 * Two independent readings of each part -> one verdict. A part is "agreed" only if BOTH readings pass the deterministic
 * gates (gatePack) AND the two readings agree on everything that decides a mark (consensus.ts). Everything else is held
 * and never shown to a person: the student sees "compare with the scheme". Agreement is not correctness.
 *
 *   npx tsx scripts/question-bank/markpacks/verify_pair.ts <dirA> <dirB> <outDir>
 *
 * Each dir holds `<partId>.json` readings; <dirA> also holds `_parts.json` and `_ocr.json` (as extract.py writes them).
 * Writes <outDir>/verdicts.json and, for agreed parts, <outDir>/<partId>.json (the fuller of the two readings).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gatePack, type BankPartRef } from "./markpack";
import { compareReadings, fuller } from "./consensus";

const [dirA, dirB, outDir] = process.argv.slice(2).map((p) => resolve(p));
mkdirSync(outDir, { recursive: true });
const parts: BankPartRef[] = JSON.parse(readFileSync(join(dirA, "_parts.json"), "utf8"));
const ocr: Record<string, string> = existsSync(join(dirA, "_ocr.json")) ? JSON.parse(readFileSync(join(dirA, "_ocr.json"), "utf8")) : {};
const read = (dir: string, id: string): unknown => { try { return JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")); } catch { return null; } };

type Row = { id: string; marks: number | null; status: "agreed" | "held" | "disagree" | "rejected" | "missing"; why: string[] };
const rows: Row[] = [];
for (const part of parts) {
  const ra = read(dirA, part.id), rb = read(dirB, part.id);
  const row: Row = { id: part.id, marks: part.m, status: "missing", why: [] };
  rows.push(row);
  if (ra === null || rb === null) { row.why = [`no reading from ${ra === null ? "A" : ""}${rb === null ? " B" : ""}`.trim()]; continue; }
  const va = gatePack(ra, part, ocr[part.id]), vb = gatePack(rb, part, ocr[part.id]);
  if (va.status === "rejected" || vb.status === "rejected") { row.status = "rejected"; row.why = [...va.reasons.map((r) => `A: ${r}`), ...vb.reasons.map((r) => `B: ${r}`)]; continue; }
  // Both readings are held by the gate (a figure, a tick, a number, levels, own doubt): the part is held whether or not they agree.
  if (va.status === "held" && vb.status === "held") { row.status = "held"; row.why = [...new Set([...va.reasons, ...vb.reasons])]; continue; }
  const c = compareReadings(va.pack, vb.pack);
  if (!c.agree) { row.status = "disagree"; row.why = c.differences; continue; }
  if (va.status === "held" || vb.status === "held") { row.status = "held"; row.why = [...new Set([...va.reasons, ...vb.reasons])]; continue; }
  row.status = "agreed";
  writeFileSync(join(outDir, `${part.id}.json`), JSON.stringify(fuller(va.pack, vb.pack), null, 1));
}
writeFileSync(join(outDir, "verdicts.json"), JSON.stringify(rows, null, 1));
const tally: Record<string, number> = {};
for (const r of rows) { tally[r.status] = (tally[r.status] ?? 0) + 1; console.log(`${r.id.padEnd(20)} ${String(r.marks).padStart(2)}m  ${r.status.padEnd(8)} ${r.why.join("; ").slice(0, 230)}`); }
console.log(JSON.stringify(tally));
