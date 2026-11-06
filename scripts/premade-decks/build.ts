/**
 * Builds the ready-made flashcard decks from the iPad app's definition files.
 *
 *     npm run decks:build                                 # read the iPad's JSON, write src/content/premadeDecks/<subject>.json
 *     npm run decks:build -- --src /path/to/Resources     # or PLUMI_RESOURCES=/path (default /home/user/plumi/Sources/PlumiKit/Resources)
 *     npm run decks:build -- --check                      # is the committed output what the source would build? (this is what CI runs)
 *
 * It also builds the iPad's MARK SCHEME cards (markscheme_cards_<spec>.json, on the iPad repo's local-dev branch) into markscheme-<spec>.json, one file a
 * specification so the website loads only the board a student opens. Those are read from `--ms-src <folder>` or PLUMI_MS_RESOURCES (default: the same folder
 * as the rest); without the files the committed ones are only verified. Make a read-only copy of the branch's Resources with
 * `git -C <plumi> archive origin/local-dev Sources/PlumiKit/Resources | tar -x -C <tmp>`. Their trees and cards are read from that one folder.
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
import { buildMarkScheme, buildSubject, render, verifyShape, type DefinitionsFile, type MarkSchemeFileCard, type SkillsFile, type SpecInput, type TopicTree } from "../../src/lib/studyapp/premadeBuild";

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

interface MsPlan { slug: string; subject: string; spec: string; label: string; code: string; tree: string }
/** The ten specifications the iPad has mark scheme cards for (A-level and AQA GCSE). */
const MS_PLAN: MsPlan[] = [
  { slug: "aqa-7402", subject: "Biology", spec: "AQA-7402", label: "AQA", code: "7402", tree: "topics_aqa_bio_7402.json" },
  { slug: "ocr-h420", subject: "Biology", spec: "OCR-H420", label: "OCR", code: "H420", tree: "topics_ocr_bio_h420.json" },
  { slug: "aqa-8461", subject: "Biology", spec: "AQA-8461", label: "AQA GCSE", code: "8461", tree: "topics_aqa_gcse_bio_8461.json" },
  { slug: "aqa-7405", subject: "Chemistry", spec: "AQA-7405", label: "AQA", code: "7405", tree: "topics_aqa_chem_7405.json" },
  { slug: "ocr-h432", subject: "Chemistry", spec: "OCR-H432", label: "OCR A", code: "H432", tree: "topics_ocr_chem_h432.json" },
  { slug: "aqa-8462", subject: "Chemistry", spec: "AQA-8462", label: "AQA GCSE", code: "8462", tree: "topics_aqa_gcse_chem_8462.json" },
  { slug: "aqa-7408", subject: "Physics", spec: "AQA-7408", label: "AQA", code: "7408", tree: "topics_aqa_phys_7408.json" },
  { slug: "ocr-h556", subject: "Physics", spec: "OCR-H556", label: "OCR", code: "H556", tree: "topics_ocr_phys_h556.json" },
  { slug: "edexcel-9ph0", subject: "Physics", spec: "EDEXCEL-9PH0", label: "Edexcel", code: "9PH0", tree: "topics_edexcel_phys_9ph0.json" },
  { slug: "aqa-8463", subject: "Physics", spec: "AQA-8463", label: "AQA GCSE", code: "8463", tree: "topics_aqa_gcse_phys_8463.json" },
];

const args = process.argv.slice(2);
const check = args.includes("--check");
const srcArg = args.indexOf("--src");
const SRC = srcArg >= 0 ? args[srcArg + 1] : process.env.PLUMI_RESOURCES ?? DEFAULT_SRC;

const msArg = args.indexOf("--ms-src");
const MS_SRC = msArg >= 0 ? args[msArg + 1] : process.env.PLUMI_MS_RESOURCES ?? SRC;
const msFile = (p: MsPlan) => `markscheme_cards_${p.slug}.json`;
const msOut = (p: MsPlan) => join(OUT, `markscheme-${p.slug}.json`);
const haveMs = MS_PLAN.every((p) => existsSync(join(MS_SRC, msFile(p))) && existsSync(join(MS_SRC, p.tree)));

function buildMs(plan: MsPlan) {
  const hashes: Record<string, string> = {};
  const read = <T,>(name: string): T => { const buf = readFileSync(join(MS_SRC, name)); hashes[name] = sha(buf); return JSON.parse(buf.toString("utf8")) as T; };
  const file = read<{ specification: string; cards: MarkSchemeFileCard[] }>(msFile(plan));
  if (file.specification !== plan.spec) throw new Error(`${msFile(plan)} is for ${file.specification}, not ${plan.spec}`);
  const tree = read<TopicTree>(plan.tree);
  return buildMarkScheme({ subject: plan.subject, cards: file.cards, spec: { id: plan.spec, label: plan.label, code: plan.code, tree }, hashes });
}

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
  for (const plan of MS_PLAN) {
    const p = msOut(plan);
    if (!existsSync(p)) { console.error(`mark scheme ${plan.slug}: ${p} is missing (run npm run decks:build -- --ms-src <folder>)`); faults++; continue; }
    const bad = verifyShape(JSON.parse(readFileSync(p, "utf8")));
    for (const b of bad.slice(0, 10)) console.error(`mark scheme ${plan.slug}: ${b}`);
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
    if (haveMs) {
      for (const plan of MS_PLAN) {
        const fresh = render(buildMs(plan).data);
        if (existsSync(msOut(plan)) && readFileSync(msOut(plan), "utf8") !== fresh) { console.error(`mark scheme ${plan.slug}: out of date against ${MS_SRC} (run npm run decks:build -- --ms-src ...)`); faults++; }
      }
    } else console.log(`mark scheme cards: not compared (no markscheme_cards_*.json at ${MS_SRC})`);
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
if (haveMs) {
  let msTotal = 0, msCards = 0, msDecks = 0;
  for (const plan of MS_PLAN) {
    const { data, report } = buildMs(plan);
    const text = render(data);
    writeFileSync(msOut(plan), text);
    msTotal += Buffer.byteLength(text); msCards += data.cards.length; msDecks += data.specs[0].mods.length;
    console.log(`Mark scheme ${plan.spec}: ${data.cards.length} cards, ${data.specs[0].mods.length} decks, ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB, placed on no module (skipped): ${report.noModule.length ? report.noModule.join(", ") : "0"}`);
  }
  console.log(`mark scheme total: ${msCards} cards, ${msDecks} decks, ${(msTotal / 1024).toFixed(1)} KB`);
  total += msTotal;
} else console.log(`Mark scheme cards not built: no markscheme_cards_*.json at ${MS_SRC} (pass --ms-src <folder>); the committed files are kept.`);
console.log(`total ${(total / 1024).toFixed(1)} KB`);
const faults = verifyCommitted();
if (faults) process.exit(1);
