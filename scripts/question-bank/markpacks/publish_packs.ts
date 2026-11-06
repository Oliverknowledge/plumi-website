/**
 * Turns AGREED packs (verify_pair.ts output) into the SQL that stores them in the private pack store (migration 0130,
 * mark_pack_publish). Writes a .sql file; it does NOT touch any database. Run the file yourself, or have it applied
 * deliberately: it publishes answer keys that students can then be marked against.
 *
 *   npx tsx scripts/question-bank/markpacks/publish_packs.ts <slug> <agreedDir> <out.sql>
 *
 * <agreedDir> holds `<partId>.json` (the agreed readings) and `verdicts.json`; only parts whose verdict is "agreed" are used.
 * Each pack's hash is computed over the reading AND the exact bytes of the question and scheme pictures on the bank's bucket
 * AND the bank's cropVersion (markpack.ts packHash), so a re-cut bank can be detected. The pictures are fetched gently: 2
 * small files a part from the public bucket (AGENTS.md: bulk reads go through the S3 API; this is for tens of parts).
 *
 * The packs are board material: keep the .sql OUT of git (it is data, not code).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { packHash, type ExtractedPack } from "./markpack";

/** The fields the marker core needs. Nothing else is stored: no labels, no model notes, no doubts. */
export function storedPack(p: ExtractedPack) {
  return {
    question_text: p.question_text, marks_printed: p.marks_printed, points: p.points, max_marks: p.max_marks,
    accept: p.accept, reject: p.reject, ignore: p.ignore, rules: p.rules, other_guidance: p.other_guidance,
  };
}

/** A dollar-quote tag that does not occur in the payload, so no content can end the literal early. */
export function dollarTag(payload: string): string {
  for (let i = 0; ; i++) { const tag = `$pk${i}$`; if (!payload.includes(tag)) return tag; }
}

const lit = (s: string) => { const t = dollarTag(s); return `${t}${s}${t}`; };

export function publishSql(slug: string, partId: string, pack: ExtractedPack, hash: string, cropVersion: number): string {
  const json = JSON.stringify(storedPack(pack));
  return `SELECT public.mark_pack_publish(${lit(slug)}, ${lit(partId)}, ${lit(json)}::jsonb, '${hash}', ${pack.marks_printed}, ${cropVersion});`;
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
function fetchBytes(url: string): Buffer {
  execFileSync("sleep", ["0.3"]);
  return execFileSync("curl", ["-sS", "--fail", "--max-time", "60", url], { maxBuffer: 20_000_000 });
}

async function main() {
  const [slug, agreedDir, outFile] = process.argv.slice(2);
  if (!slug || !agreedDir || !outFile) throw new Error("usage: publish_packs.ts <slug> <agreedDir> <out.sql>");
  const root = resolve(__dirname, "../../..");
  const base = /R2_DEV_URL = "([^"]+)"/.exec(readFileSync(join(root, "src/config/papers.ts"), "utf8"))![1];
  const meta = JSON.parse(readFileSync(join(root, "src/content/questionBank", `${slug}.json`), "utf8")) as { cropVersion?: number };
  const cv = meta.cropVersion ?? 0;
  const verdicts = JSON.parse(readFileSync(join(resolve(agreedDir), "verdicts.json"), "utf8")) as { id: string; status: string }[];
  const lines = [`-- Mark packs for ${slug}, crop version ${cv}. Generated, not for git. Applies mark_pack_publish (migration 0130).`, "BEGIN;"];
  let n = 0;
  for (const v of verdicts.filter((x) => x.status === "agreed")) {
    const pack = JSON.parse(readFileSync(join(resolve(agreedDir), `${v.id}.json`), "utf8")) as ExtractedPack;
    const qp = fetchBytes(`${base}/bank/${v.id}-qp.webp`), ms = fetchBytes(`${base}/bank/${v.id}-ms.webp?v=${Math.max(2, cv)}`);
    const hash = await packHash(pack, { partId: v.id, qpSha256: sha(qp), msSha256: sha(ms), cropVersion: cv });
    lines.push(publishSql(slug, v.id, pack, hash, cv)); n++;
  }
  lines.push("COMMIT;");
  writeFileSync(resolve(outFile), lines.join("\n") + "\n");
  console.log(`${n} packs written to ${outFile} (not applied anywhere)`);
}

if (process.argv[1]?.endsWith("publish_packs.ts")) void main();
