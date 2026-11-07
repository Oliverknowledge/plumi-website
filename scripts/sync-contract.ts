/**
 * npm run sync:contract
 *
 * Holds the website's copy of the sync wire contract (src/lib/studyapp/sync/CONTRACT.json) to the original in the iPad repo
 * (tools/sync-contract/CONTRACT.json). Set SYNC_CONTRACT_SOURCE to that file (or to its folder). Fails when the two differ by a
 * single byte; says "skipped (no SYNC_CONTRACT_SOURCE)" and exits 0 when the variable is not set, so a checkout without the iPad
 * repo is not stopped.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
// The real answers written by the SQL (tools/sync-contract/fixtures): the website's copies must match too.
const fixturesFrom = join(existsSync(source) && statSync(source).isDirectory() ? source : join(source, ".."), "fixtures");
const fixturesTo = join(__dirname, "..", "src", "lib", "studyapp", "sync", "fixtures");
if (existsSync(fixturesFrom)) {
  const names = readdirSync(fixturesFrom).filter((n) => n.endsWith(".json")).sort();
  const have = existsSync(fixturesTo) ? readdirSync(fixturesTo).filter((n) => n.endsWith(".json")).sort() : [];
  if (names.join() !== have.join()) {
    console.error(`FAILED: the fixtures differ: original has [${names.join(", ")}], the website has [${have.join(", ")}].`);
    process.exit(1);
  }
  for (const n of names) {
    if (!readFileSync(join(fixturesFrom, n)).equals(readFileSync(join(fixturesTo, n)))) {
      console.error(`FAILED: fixtures/${n} differs from the original in ${fixturesFrom}.`);
      process.exit(1);
    }
  }
  console.log(`ok: ${names.length} fixtures are byte-identical to the originals`);
}
console.log("ok: the website's CONTRACT.json is byte-identical to the original");
