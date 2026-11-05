/**
 * npm run sharing:contract
 *
 * Holds the website's sharing code to the contract the database migration publishes (0130 in the iPad repo). Reads CONTRACT.json
 * from the iPad repo's tools/shared-decks-check/ (override the folder, or the file, with SHARED_DECKS_CONTRACT) and fails when a
 * function name, a parameter name, a limit or an error code in src/lib/studyapp/sharing/contract.ts differs from it. When the
 * file is not there it says so and exits 0 (skipped), so a checkout without the iPad repo is not stopped.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CODE_PATTERN, ERROR_CODES, SHARE_LIMITS, SHARE_RPC } from "../src/lib/studyapp/sharing/contract";

const where = process.env.SHARED_DECKS_CONTRACT ?? "/home/user/sharedecks-ipad/tools/shared-decks-check";
const file = existsSync(where) && statSync(where).isDirectory() ? join(where, "CONTRACT.json") : where;
if (!existsSync(file)) {
  console.log(`SKIPPED: no contract at ${file}. Set SHARED_DECKS_CONTRACT to the iPad repo's tools/shared-decks-check folder to check.`);
  process.exit(0);
}

interface Contract {
  rpcs: { name: string; args: { name: string; required?: boolean }[]; errors?: string[] }[];
  error_codes: Record<string, string>;
  limits: Record<string, number | Record<string, unknown>>;
}
const c = JSON.parse(readFileSync(file, "utf8")) as Contract;
const problems: string[] = [];
const bad = (m: string) => problems.push(m);

// 1. every function and parameter the web calls exists, with the same names (and nothing the web sends is unknown)
for (const [key, call] of Object.entries(SHARE_RPC)) {
  const rpc = c.rpcs.find((r) => r.name === call.name);
  if (!rpc) { bad(`${key}: the contract has no function ${call.name}`); continue; }
  const theirs = rpc.args.map((a) => a.name);
  for (const a of call.args) if (!theirs.includes(a)) bad(`${call.name}: the web sends ${a}, which the contract does not have (it has: ${theirs.join(", ") || "none"})`);
  for (const a of rpc.args) if (a.required && !(call.args as readonly string[]).includes(a.name)) bad(`${call.name}: the contract requires ${a.name}, which the web does not send`);
}
const known = new Set(Object.values(SHARE_RPC).map((r) => r.name));
for (const r of c.rpcs) if (!known.has(r.name)) bad(`the contract has ${r.name}, which the web does not use (fine if intended, but check it)`);

// 2. the error words
const theirCodes = Object.keys(c.error_codes);
for (const code of theirCodes) if (!(ERROR_CODES as readonly string[]).includes(code)) bad(`the database can raise ${code}, which the web has no line for`);
for (const code of ERROR_CODES) if (!theirCodes.includes(code)) bad(`the web maps ${code}, which the contract does not list`);
if (!/social:/.test(JSON.stringify((c as unknown as { error?: unknown }).error ?? ""))) bad("the contract no longer says errors arrive as social:<code>");

// 3. limits
const L = c.limits as Record<string, number>;
const same: [string, number][] = [
  ["max_cards", SHARE_LIMITS.maxCards], ["side_min_chars", SHARE_LIMITS.minCardChars], ["side_max_chars", SHARE_LIMITS.maxCardChars],
  ["title_max_chars", SHARE_LIMITS.maxTitleChars], ["subject_hint_max_chars", SHARE_LIMITS.maxSubjectChars],
  ["max_live_decks_per_student", SHARE_LIMITS.liveDecksPerStudent], ["max_shares_per_student_per_24h", SHARE_LIMITS.sharesPerDay],
  ["max_cards_json_bytes", SHARE_LIMITS.maxJsonBytes],
];
for (const [k, mine] of same) if (L[k] !== mine) bad(`limit ${k}: the contract says ${L[k]}, the web has ${mine}`);

// 4. the code shape
const code = c.limits.code as { length: number; alphabet: string; min_length_accepted: number };
const sample = Array.from({ length: code.length }, (_, i) => code.alphabet[i % code.alphabet.length]).join("");
if (!CODE_PATTERN.test(sample)) bad(`a code the database mints (${sample}) does not pass the web's CODE_PATTERN`);
if (!CODE_PATTERN.test("a".repeat(code.min_length_accepted))) bad(`a code of ${code.min_length_accepted} characters, which the database accepts, does not pass the web's CODE_PATTERN`);
if (CODE_PATTERN.test("a".repeat(code.min_length_accepted - 1))) bad(`the web accepts codes shorter than the database's ${code.min_length_accepted}`);

if (problems.length) {
  console.error(`DIFFERS from ${file}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`ok: ${Object.keys(SHARE_RPC).length} functions, ${ERROR_CODES.length} error words, ${same.length} limits and the code shape match ${file}`);
