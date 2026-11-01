/**
 * Runs supabase/checks/social_applied.sql against a database and fails if anything is MISSING.
 *
 *   PGHOST=... PGUSER=... PGDATABASE=... npm run social:contract
 *
 * Uses psql and its usual environment (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, or a service),
 * so it reads whichever database you point it at and writes nothing. Pointed at the project's own
 * database it answers "is this project ready for the website's multiplayer?"; pointed at the app repo's
 * tools/social-check database it holds the web code to the app's migrations.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const file = resolve(__dirname, "../supabase/checks/social_applied.sql");
let out: string;
try {
  out = execFileSync("psql", ["-X", "-q", "-A", "-F", "\t", "-t", "-v", "ON_ERROR_STOP=1", "-f", file], { stdio: ["ignore", "pipe", "pipe"] }).toString();
} catch (e) {
  console.error((e as { stderr?: Buffer }).stderr?.toString() || String(e));
  process.exit(2);
}

const rows = out.split("\n").filter(Boolean).map((l) => l.split("\t"));
const missing = rows.filter((r) => r[2] !== "ok");
for (const [area, what, status, note] of rows) {
  if (status !== "ok" || process.argv.includes("--all")) console.log(`${status === "ok" ? "ok     " : "MISSING"}  ${area.padEnd(9)} ${what}${note ? `  (${note})` : ""}`);
}
console.log(`\n${rows.length - missing.length} of ${rows.length} checks ok${missing.length ? `, ${missing.length} MISSING` : ""}.`);
process.exit(missing.length ? 1 : 0);
