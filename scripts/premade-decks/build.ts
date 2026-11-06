/**
 * Builds the ready-made flashcard decks from the iPad app's definition files.
 *
 *     npm run decks:build                                 # read the iPad's JSON, write src/content/premadeDecks/<subject>.json
 *     npm run decks:build -- --src /path/to/Resources     # or PLUMI_RESOURCES=/path (default /home/user/plumi/Sources/PlumiKit/Resources)
 *     npm run decks:build -- --check                      # is the committed output what the source would build? (this is what CI runs)
 *
 * Only the committed output is read by the website; the iPad repository is not a dependency. In CI the iPad's files are not there, so
 * `--check` then verifies the committed data on its own (shape, indexes, no em dash, no held-back card). With the files beside it, it rebuilds
 * in memory and compares byte for byte, which also catches a source that changed after the build. The output has no dates and a fixed order.
 * See docs/study/premade-decks.md.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSubject, render, verifyShape, type DefinitionsFile, type SkillsFile, type SpecInput, type TopicTree } from "../../src/lib/studyapp/premadeBuild";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "src", "content", "premadeDecks");
const DEFAULT_SRC = "/home/user/plumi/Sources/PlumiKit/Resources";

interface SubjectPlan { slug: string; subject: string; file: string; skills?: string; specs: { id: string; label: string; code: string; tree: string }[] }

/** The three subjects, and the boards each covers (A-level: the iPad has no GCSE definitions). Economics is not built yet. */
const PLAN: SubjectPlan[] = [
  { slug: "biology", subject: "Biology", file: "biology_definitions.json", specs: [
    { id: "AQA-7402", label: "AQA", code: "7402", tree: "topics_aqa_bio_7402.json" },
    { id: "OCR-H420", label: "OCR", code: "H420", tree: "topics_ocr_bio_h420.json" },
    { id: "EDEXCEL-9BN0", label: "Edexcel", code: "9BN0", tree: "topics_edexcel_bio_9bn0.json" },
  ] },
  { slug: "chemistry", subject: "Chemistry", file: "chemistry_definitions.json", specs: [
    { id: "AQA-7405", label: "AQA", code: "7405", tree: "topics_aqa_chem_7405.json" },
    { id: "OCR-H432", label: "OCR A", code: "H432", tree: "topics_ocr_chem_h432.json" },
    { id: "OCR-H433", label: "OCR B", code: "H433", tree: "topics_ocr_chem_h433.json" },
    { id: "EDEXCEL-9CH0", label: "Edexcel", code: "9CH0", tree: "topics_edexcel_chem_9ch0.json" },
  ] },
  { slug: "physics", subject: "Physics", file: "physics_definitions.json", skills: "canonical_skills_physics.json", specs: [
    { id: "AQA-7408", label: "AQA", code: "7408", tree: "topics_aqa_phys_7408.json" },
    { id: "OCR-H556", label: "OCR", code: "H556", tree: "topics_ocr_phys_h556.json" },
    { id: "EDEXCEL-9PH0", label: "Edexcel", code: "9PH0", tree: "topics_edexcel_phys_9ph0.json" },
  ] },
];

const args = process.argv.slice(2);
const check = args.includes("--check");
const srcArg = args.indexOf("--src");
const SRC = srcArg >= 0 ? args[srcArg + 1] : process.env.PLUMI_RESOURCES ?? DEFAULT_SRC;

const sha = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");
const outPath = (slug: string) => join(OUT, `${slug}.json`);

function build(plan: SubjectPlan) {
  const hashes: Record<string, string> = {};
  const read = <T,>(name: string): T => {
    const buf = readFileSync(join(SRC, name));
    hashes[name] = sha(buf);
    return JSON.parse(buf.toString("utf8")) as T;
  };
  const file = read<DefinitionsFile>(plan.file);
  const skills = plan.skills ? read<SkillsFile>(plan.skills) : undefined;
  const specs: SpecInput[] = plan.specs.map((s) => ({ id: s.id, label: s.label, code: s.code, tree: read<TopicTree>(s.tree) }));
  return buildSubject({ subject: plan.subject, file, specs, skills, hashes });
}

function verifyCommitted(): number {
  let faults = 0;
  for (const plan of PLAN) {
    const p = outPath(plan.slug);
    if (!existsSync(p)) { console.error(`${plan.slug}: ${p} is missing (run npm run decks:build)`); faults++; continue; }
    const bad = verifyShape(JSON.parse(readFileSync(p, "utf8")));
    for (const b of bad.slice(0, 10)) console.error(`${plan.slug}: ${b}`);
    faults += bad.length;
  }
  return faults;
}

const haveSource = PLAN.every((p) => existsSync(join(SRC, p.file)));

if (check) {
  let faults = verifyCommitted();
  if (haveSource) {
    for (const plan of PLAN) {
      const fresh = render(build(plan).data);
      const p = outPath(plan.slug);
      if (existsSync(p) && readFileSync(p, "utf8") !== fresh) { console.error(`${plan.slug}: out of date against ${SRC} (run npm run decks:build)`); faults++; }
    }
    console.log(faults ? "decks: not up to date" : `decks: up to date with ${SRC}`);
  } else {
    console.log(faults ? "decks: committed data has faults" : `decks: committed data is sound (the iPad's files are not at ${SRC}, so not compared with them)`);
  }
  process.exit(faults ? 1 : 0);
}

if (!haveSource) { console.error(`The iPad's definition files are not at ${SRC}. Pass --src <folder> or set PLUMI_RESOURCES.`); process.exit(1); }
mkdirSync(OUT, { recursive: true });
let total = 0;
for (const plan of PLAN) {
  const { data, report } = build(plan);
  const text = render(data);
  writeFileSync(outPath(plan.slug), text);
  total += Buffer.byteLength(text);
  const decks = data.specs.reduce((n, s) => n + s.mods.length, 0);
  console.log(`${plan.subject}: ${data.cards.length} cards, ${decks} decks over ${data.specs.length} boards, ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB`);
  console.log(`  held back (sign_off): ${data.held.length ? data.held.join(", ") : "none"}`);
  console.log(`  placed on no board, skipped: ${data.unmapped.length ? data.unmapped.join(", ") : "0"}`);
  for (const s of data.specs) {
    const n = report.noModule[s.id]?.length ?? 0;
    console.log(`  ${s.id}: ${s.mods.length} decks, ${s.mods.reduce((a, m) => a + m.k.length, 0)} cards, ${report.notTaught[s.id] ?? 0} not on this board${n ? `, ${n} with a code in no module (${report.noModule[s.id].join(", ")})` : ""}`);
  }
}
console.log(`total ${(total / 1024).toFixed(1)} KB`);
const faults = verifyCommitted();
if (faults) process.exit(1);
