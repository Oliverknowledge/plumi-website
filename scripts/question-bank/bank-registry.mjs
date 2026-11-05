/**
 * Writes src/content/questionBank.generated.ts from the metas in src/content/questionBank/, so adding a bank
 * touches no shared file: the meta is the registration. Git ignores the output, because a committed list of banks
 * is the line every parallel bank PR would conflict on.
 *
 *     npm run bank:registry
 *
 * It runs by itself when next.config.ts loads (dev, build, typegen), after `npm ci`, and before the npm scripts that
 * typecheck or test the bank's code. It only writes when the output changes, so a running dev server isn't disturbed.
 * Needs nothing installed: no imports beyond Node's own.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const META = join(ROOT, "src", "content", "questionBank");
const OUT = join(ROOT, "src", "content", "questionBank.generated.ts");

/**
 * The banks' order before this file existed. Order reaches students in My board's subject search, which shows the
 * first 8 matches in this order, and it sets the sitemap's. Don't add to this: a new bank goes after these, by slug,
 * so two banks merged in either order come out the same. Every other list sorts for itself (BankPages.tsx, CosyHome.tsx).
 */
const FIRST = `
edexcel-a-level-maths edexcel-a-level-further-maths aqa-a-level-maths aqa-a-level-further-maths aqa-a-level-biology
aqa-a-level-chemistry aqa-a-level-physics aqa-a-level-psychology aqa-a-level-economics aqa-a-level-sociology
aqa-a-level-politics aqa-a-level-law aqa-a-level-business aqa-a-level-history aqa-a-level-geography
aqa-a-level-philosophy aqa-a-level-religious-studies aqa-a-level-computer-science aqa-a-level-english-literature-a
aqa-a-level-english-literature-b aqa-a-level-english-language aqa-a-level-french aqa-a-level-spanish aqa-a-level-german
aqa-a-level-physical-education edexcel-a-level-biology-a edexcel-a-level-biology-b edexcel-a-level-chemistry
edexcel-a-level-physics edexcel-a-level-economics-a edexcel-a-level-economics-b edexcel-a-level-business
edexcel-a-level-geography edexcel-a-level-psychology edexcel-a-level-politics edexcel-a-level-english-literature
edexcel-a-level-history ocr-a-level-biology-a ocr-a-level-chemistry-a ocr-a-level-physics-a ocr-a-level-biology-b
ocr-a-level-chemistry-b ocr-a-level-physics-b ocr-a-level-maths ocr-a-level-further-maths ocr-a-level-computer-science
ocr-a-level-economics ocr-a-level-business ocr-a-level-law ocr-a-level-psychology ocr-a-level-sociology
ocr-a-level-english-literature ocr-a-level-religious-studies ocr-a-level-history-a ocr-mei-a-level-maths
ocr-mei-a-level-further-maths caie-a-level-maths caie-a-level-further-maths caie-a-level-biology caie-a-level-chemistry
caie-a-level-physics eduqas-a-level-physics eduqas-a-level-chemistry eduqas-a-level-biology
eduqas-a-level-religious-studies eduqas-a-level-english-literature caie-igcse-maths caie-igcse-additional-maths
caie-igcse-biology caie-igcse-chemistry caie-igcse-physics wjec-a-level-maths wjec-a-level-further-maths
wjec-a-level-biology wjec-a-level-chemistry wjec-a-level-physics wjec-a-level-business wjec-criminology aqa-gcse-biology
aqa-gcse-chemistry aqa-gcse-physics aqa-gcse-english-literature aqa-gcse-combined-science edexcel-gcse-biology
edexcel-gcse-chemistry edexcel-gcse-physics aqa-gcse-maths edexcel-gcse-maths ocr-gcse-maths aqa-level-2-further-maths
aqa-gcse-english-language aqa-gcse-computer-science edexcel-gcse-computer-science ocr-gcse-computer-science
eduqas-gcse-religious-studies eduqas-gcse-history eduqas-gcse-english-language eduqas-gcse-english-literature
aqa-gcse-geography edexcel-gcse-geography-b aqa-gcse-religious-studies aqa-gcse-business ocr-gcse-biology-a
ocr-gcse-chemistry-a ocr-gcse-physics-a ocr-gcse-combined-science-a aqa-gcse-history edexcel-gcse-business
edexcel-gcse-combined-science edexcel-gcse-history edexcel-gcse-english-language edexcel-gcse-english-literature
edexcel-igcse-maths edexcel-igcse-biology edexcel-igcse-chemistry edexcel-igcse-physics ocr-gcse-geography-b
ocr-gcse-economics ocr-gcse-classical-civilisation aqa-gcse-french aqa-gcse-spanish aqa-gcse-bengali
edexcel-igcse-islamic-studies ocr-cn-engineering-manufacture aqa-gcse-psychology edexcel-ial-biology edexcel-ial-chemistry
edexcel-ial-physics edexcel-ial-maths edexcel-ial-further-maths aqa-gcse-citizenship
aqa-gcse-food-preparation-and-nutrition edexcel-gcse-religious-studies aqa-gcse-german aqa-gcse-physical-education
aqa-gcse-design-and-technology edexcel-gcse-french
`.trim().split(/\s+/);

/**
 * Each bank's meta, in the order to import them: the bundler lays the metas out in import order, and this one gzips about
 * 1% smaller than file name or the site's order. The folder also holds lists that aren't banks (files.json), with no slug.
 */
function banks() {
  const key = ({ file, meta }) => [meta.subject, meta.level, meta.board, file].join("\0");
  return readdirSync(META)
    .filter(name => name.endsWith(".json"))
    .map(name => ({ file: name, meta: JSON.parse(readFileSync(join(META, name), "utf8")) }))
    .filter(({ meta }) => meta.slug)
    .sort((a, b) => (key(a) < key(b) ? -1 : 1));
}

/** Where a bank goes in the site's order; slugs break the tie among new banks. */
function bySiteOrder(a, b) {
  const rank = slug => {
    const at = FIRST.indexOf(slug);
    return at < 0 ? FIRST.length : at;
  };
  return rank(a.meta.slug) - rank(b.meta.slug) || (a.meta.slug < b.meta.slug ? -1 : 1);
}

function source() {
  const list = banks().map((bank, i) => ({ ...bank, name: `bank${i}` }));
  const ordered = [...list].sort(bySiteOrder);
  const subjects = [...new Set(list.map(({ meta }) => meta.subject))].sort();
  return [
    "// Written by scripts/question-bank/bank-registry.mjs from src/content/questionBank/*.json. Don't edit it: git ignores it.",
    ...list.map(({ file, name }) => `import ${name} from "./questionBank/${file}";`),
    "",
    `export const bankMetas = [${ordered.map(({ name }) => name).join(", ")}];`,
    "",
    `export type BankSubjectName = ${subjects.map(s => JSON.stringify(s)).join(" | ")};`,
    "",
  ].join("\n");
}

const next = source();
let current = "";
try {
  current = readFileSync(OUT, "utf8");
} catch {
  // First run in this checkout.
}
if (next !== current) writeFileSync(OUT, next);
