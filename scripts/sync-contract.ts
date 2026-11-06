/**
 * npm run sync:contract
 *
 * Holds the website's copy of the sync wire contract (src/lib/studyapp/sync/CONTRACT.json) to the original in the iPad repo
 * (tools/sync-contract/CONTRACT.json). Set SYNC_CONTRACT_SOURCE to that file (or to its folder). Fails when the two differ by a
 * single byte; says "skipped (no SYNC_CONTRACT_SOURCE)" and exits 0 when the variable is not set, so a checkout without the iPad
 * repo is not stopped.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const source = process.env.SYNC_CONTRACT_SOURCE;
if (!source) {
  console.log("skipped (no SYNC_CONTRACT_SOURCE)");
  process.exit(0);
}
const original = existsSync(source) && statSync(source).isDirectory() ? join(source, "CONTRACT.json") : source;
if (!existsSync(original)) {
  console.error(`FAILED: SYNC_CONTRACT_SOURCE is set but there is no file at ${original}`);
  process.exit(1);
}
const copy = join(__dirname, "..", "src", "lib", "studyapp", "sync", "CONTRACT.json");
if (!readFileSync(original).equals(readFileSync(copy))) {
  console.error(`FAILED: ${copy} differs from ${original}. Copy the original over it (the iPad repo owns the file).`);
  process.exit(1);
}
console.log("ok: the website's CONTRACT.json is byte-identical to the original");
