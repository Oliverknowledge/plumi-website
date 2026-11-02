/**
 * npm run library:test
 *
 * The people store builds rows one at a time, the wanted ones first, in small steps with the page given a turn
 * between them (50 people arriving together was a half-second freeze), and what it builds is exactly `composeRow`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { PeopleStore, PRIORITY } from "./store";
import { personOf, type PeopleCatalogue } from "./look";
import { LayerPack } from "./layers";
import { composeRow } from "./sheet";

const dir = new URL("../../../../../public/library/", import.meta.url);
const catJson = readFileSync(new URL("people-layers.json", dir), "utf8");
const bin = readFileSync(new URL("people-layers.bin", dir));
const cat = JSON.parse(catJson) as PeopleCatalogue;

const g = globalThis as unknown as Record<string, unknown>;
let painted: Uint8ClampedArray[];
beforeEach(() => {
  painted = [];
  g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData: (d: { data: Uint8ClampedArray }) => painted.push(d.data) }) }) };
  g.ImageData = class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} };
});
afterEach(() => { delete g.document; delete g.ImageData; });

const fetcher = async (url: string) => ({
  ok: true,
  json: async () => JSON.parse(catJson) as unknown,
  arrayBuffer: async () => bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer,
  url,
});
const looks = Array.from({ length: 8 }, (_, i) => personOf(cat, null, i, "person-" + i));

function store(opts: { clock?: () => number } = {}) {
  let yields = 0;
  const s = new PeopleStore(fetcher, Date.now, async () => { yields++; await new Promise((r) => setImmediate(r)); }, opts.clock);
  return { s, yields: () => yields };
}
const settle = async (s: PeopleStore, n: number) => {
  for (let i = 0; i < 4000 && s.cached() < n; i++) await new Promise((r) => setImmediate(r));
  assert.equal(s.cached(), n, "all built");
};

describe("PeopleStore builds a crowd without a freeze", () => {
  it("builds the most wanted first: you, then by distance", async () => {
    const { s } = store();
    await s.ready();
    const order: string[] = [];
    s.subscribe(() => { for (const l of looks) { const d = s.peek(l); if (d && !order.includes(l.hair + l.outfit + l.body + l.eyes)) order.push(l.hair + l.outfit + l.body + l.eyes); } });
    const id = (i: number) => looks[i].hair + looks[i].outfit + looks[i].body + looks[i].eyes;
    // all asked in one go, far ones first
    s.row(looks[0], true, 900);
    s.row(looks[1], true, 100);
    s.row(looks[2], true, 500);
    s.row(looks[3], true, PRIORITY.you);
    assert.equal(new Set(looks.slice(0, 4).map((_, i) => id(i))).size, 4, "four different looks");
    await settle(s, 4);
    assert.deepEqual(order, [id(3), id(1), id(2), id(0)], "you, then nearest to farthest (none starts before all four are asked)");
  });

  it("gives the page a turn between rows, and inside a row when it runs long", async () => {
    let t = 0;
    const slow = store({ clock: () => (t += 10) });                 // every step looks 10 ms long
    await slow.s.ready();
    for (const l of looks.slice(0, 3)) slow.s.row(l);
    await settle(slow.s, 3);
    const fastClock = store({ clock: () => 0 });                    // no step ever looks long
    await fastClock.s.ready();
    for (const l of looks.slice(0, 3)) fastClock.s.row(l);
    await settle(fastClock.s, 3);
    assert.ok(fastClock.yields() >= 3, "at least one turn per row");
    assert.ok(slow.yields() > fastClock.yields() + 30, `mid-row turns when slow (${slow.yields()} vs ${fastClock.yields()})`);
  });

  it("builds exactly what composeRow makes", async () => {
    const { s } = store();
    const pack = new LayerPack(cat, new Uint8Array(bin));
    const look = looks[5];
    const d = await s.make(look);
    assert.ok(d);
    const known = d.look;
    await pack.load(["body/" + known.body, "eyes/" + known.eyes, "outfit/" + known.outfit, "hair/" + known.hair, ...(known.accessory ? ["acc/" + known.accessory] : [])]);
    const books = cat.parts.books;
    // the book is the store's own choice; ask the store's row for the reference by rebuilding with the same rule
    const { stableHash, lookKey } = await import("./look");
    const book = books.length ? books[stableHash(lookKey(known)) % books.length].id : null;
    if (book) await pack.load(["book/" + book]);
    const want = composeRow(cat, known, pack.source, { book, graded: true });
    assert.ok(want);
    assert.deepEqual(Buffer.from(painted[0]), Buffer.from(want));
  });

  it("asks for the same look twice and builds it once; make waits for the row", async () => {
    const { s } = store();
    await s.ready();
    assert.equal(s.row(looks[1]), null, "not ready: the premade look stays");
    assert.equal(s.row(looks[1]), null);
    const d = await s.make(looks[1]);
    assert.ok(d);
    assert.equal(painted.length, 1);
    assert.equal(s.row(looks[1]), d);
  });
});
