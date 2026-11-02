/**
 * npm run town:build   (tsx tools/town/build.ts)
 *
 * The first district, compiled: tools/town/blueprint.json (hand-authored) + the art catalogues in docs/study/art/town/ -> public/town/v1/:
 *   town.<hash>.json                    the compiled map (ground tile ids, objects, sit spots, sprites with rects)
 *   town-ground|nature|cafe|cottage|props.<hash>.png   the atlases, copied under content hashes (served immutable: next.config.ts)
 * and src/lib/town/assets.generated.ts (the URLs the page asks for). tools/town/spot-registry.json is APPEND-ONLY: a spot keeps its id for ever.
 * The build refuses to write a map the validator (src/lib/town/validate.ts) rejects.
 * No model calls. Deterministic: the same blueprint and art give the same bytes.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Blueprint } from "../../src/lib/town/blueprint";
import { compileTown, type Catalog, type Registry } from "../../src/lib/town/compile";
import { validateTown } from "../../src/lib/town/validate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ART = join(ROOT, "docs/study/art/town");
const OUT = join(ROOT, "public/town/v1");
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const hash = (b: Buffer) => createHash("sha1").update(b).digest("hex").slice(0, 10);

/** The cottage set the town uses: the door-height cut (door = one person, as the cafe's). See tools/art/cottages.py. */
export const COTTAGE_SET = "-door";

function main() {
  const bp = json(join(ROOT, "tools/town/blueprint.json")) as Blueprint;
  const registry = json(join(ROOT, "tools/town/spot-registry.json")) as Registry;
  const g = json(join(ART, "town-ground.json"));
  const nat = json(join(ART, "town-nature.json")), cafe = json(join(ART, "town-cafe.json"));
  const cot = json(join(ART, `town-cottages${COTTAGE_SET}.json`)), props = json(join(ART, "town-atlas-fine.json"));
  const files: [string, string][] = [
    ["ground", join(ART, "town-ground-32.png")], ["nature", join(ART, "town-nature.png")], ["cafe", join(ART, "town-cafe.png")],
    ["cottage", join(ART, `town-cottages${COTTAGE_SET}.png`)], ["props", join(ART, "town-atlas-fine.png")],
  ];
  const urls: Record<string, string> = {};
  const STRIP_ROWS = [6, 3, 8, 13, 18, 23, 28, 33, 0];     // people.png rows: you, then the bots'
  const stripPath = join(ROOT, "tools/town/.people-strip.png");
  execFileSync("python3", ["-W", "ignore", join(ROOT, "tools/town/people_strip.py"), stripPath, ...STRIP_ROWS.map(String)], { stdio: "pipe" });
  files.push(["premade", stripPath]);
  const names: [string, string][] = [];
  for (const [k, src] of files) {
    const name = `town-${k}.${hash(readFileSync(src))}.png`;
    names.push([src, name]);
    urls[k] = `/town/v1/${name}`;
  }
  const size = (p: string): [number, number] => { const b = readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  const cat: Catalog = {
    ground: { tiles: g.tiles, fillFamilies: g.fillFamilies, edgeSets: g.edgeSets, cols: g.cols },
    nature: { objects: nat.objects, size: nat.size },
    cafe: { building: cafe.building, size: cafe.size },
    cottages: { buildings: cot.buildings, size: cot.size },
    props: { props: props.props, size: props.size },
    groundSize: size(files[0][1]),
  };
  const c = compileTown(bp, cat, { ...urls, premadeRows: STRIP_ROWS.length } as never, registry);
  const report = validateTown(c.data, bp);
  for (const p of [...c.problems, ...report.failures]) console.error("PROBLEM:", p);
  if ((c.problems.length || report.failures.length) && !process.env.TOWN_FORCE) { console.error(`town:build refused: ${c.problems.length + report.failures.length} problems`); process.exit(1); }
  rmSync(OUT, { recursive: true, force: true });       // only once the map is valid
  mkdirSync(OUT, { recursive: true });
  for (const [src, name] of names) copyFileSync(src, join(OUT, name));
  const body = JSON.stringify(c.data);
  const dh = hash(Buffer.from(body));
  writeFileSync(join(OUT, `town.${dh}.json`), body);
  writeFileSync(join(ROOT, "tools/town/spot-registry.json"), JSON.stringify(c.registry, null, 1) + "\n");
  writeFileSync(join(ROOT, "src/lib/town/assets.generated.ts"),
    `// Written by tools/town/build.ts. Do not edit.\nexport const TOWN_DATA_URL = "/town/v1/town.${dh}.json";\n`);
  const total = readdirSync(OUT).map((f) => readFileSync(join(OUT, f)).length).reduce((a, b) => a + b, 0);
  console.log(`town:build ok. ${c.data.stats.objects} objects, ${c.data.stats.spots} sit spots, ${total} bytes in public/town/v1 (json ${body.length}).`);
  console.log(JSON.stringify(c.data.stats), "validator:", JSON.stringify(report.summary));
}
main();
