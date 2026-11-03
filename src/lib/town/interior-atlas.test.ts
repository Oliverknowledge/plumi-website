/**
 * npm run town:test   (node:test via tsx; no browser)
 *
 * The interior prop kit's atlas manifests (tools/art/interior_props.py): 48 props, 8 on each of 6 sheets, every rect inside its sprite,
 * every sprite inside the atlas, walls have a mount height, seats have a face and a depth, tables have seat slots that name real chairs.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

interface R { x: number; y: number; w: number; h: number }
interface Obj {
  name: string; sheet: string; kind: string; x: number; y: number; w: number; h: number; anchorX: number; anchorY: number; scale: number;
  recommendedScale: number; scaleVsS2: number; wall?: boolean; flat?: boolean; mountHeight?: number; footprint: R | null; topRect?: R;
  seats?: { at: { x: number; y: number }; face: string; pose: string; depth: string }[]; frontCut?: number | null; backCut?: number | null;
  seatSlots?: { side: string; face: string; chair: string; dx: number; dy: number }[];
}
interface Doc { image: string; size: [number, number]; person: number; scaled: boolean; objects: Obj[] }

const dir = new URL("../../../docs/study/art/interior/", import.meta.url);
const load = (n: string) => JSON.parse(readFileSync(new URL(n, dir), "utf8")) as Doc;
const inside = (r: R, w: number, h: number) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;

for (const file of ["interior-atlas.json", "interior-atlas-unscaled.json"]) {
  describe(`interior atlas ${file}`, () => {
    const doc = load(file);
    const by = new Map(doc.objects.map((o) => [o.name, o]));
    it("has 48 uniquely named props, 8 on each of 6 sheets, and its png", () => {
      assert.equal(doc.objects.length, 48);
      assert.equal(by.size, 48);
      assert.ok(existsSync(new URL(doc.image, dir)));
      const sheets = new Map<string, number>();
      for (const o of doc.objects) sheets.set(o.sheet, (sheets.get(o.sheet) ?? 0) + 1);
      assert.deepEqual([...sheets.values()], [8, 8, 8, 8, 8, 8]);
      assert.equal(doc.person, 25);
    });
    it("keeps every sprite inside the atlas, and the anchor, footprint and top inside the sprite", () => {
      for (const o of doc.objects) {
        assert.ok(inside(o, doc.size[0], doc.size[1]), `${o.name} in atlas`);
        assert.ok(o.anchorX >= 0 && o.anchorX < o.w && o.anchorY >= 0 && o.anchorY < o.h, `${o.name} anchor`);
        if (o.footprint) assert.ok(inside(o.footprint, o.w, o.h), `${o.name} footprint ${JSON.stringify(o.footprint)}`);
        if (o.topRect) assert.ok(inside(o.topRect, o.w, o.h), `${o.name} topRect`);
      }
    });
    it("has no overlapping sprites in the atlas", () => {
      const os = doc.objects;
      for (let i = 0; i < os.length; i++) for (let j = i + 1; j < os.length; j++) {
        const a = os[i], b = os[j];
        assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.name} / ${b.name}`);
      }
    });
    it("gives wall props a mount height and no footprint, floor props a footprint", () => {
      for (const o of doc.objects) {
        if (o.wall) { assert.ok((o.mountHeight ?? 0) > 0, o.name); assert.equal(o.footprint, null, o.name); }
        else if (o.flat) assert.equal(o.footprint, null, o.name);
        else assert.ok(o.footprint && o.footprint.w > 0 && o.footprint.h > 0, o.name);
      }
    });
    it("gives every seat a face, a pose and a depth, and cuts inside the sprite", () => {
      for (const o of doc.objects.filter((p) => p.seats)) {
        for (const s of o.seats!) {
          assert.ok(["left", "right", "front", "back"].includes(s.face), o.name);
          assert.ok(["sit", "read", "phone", "stool"].includes(s.pose), o.name);
          assert.ok(["behind", "between", "front"].includes(s.depth), o.name);
          assert.ok(s.at.x >= 0 && s.at.x < o.w && s.at.y >= 0 && s.at.y < o.h, `${o.name} seat`);
        }
        for (const c of [o.frontCut, o.backCut]) if (c != null) assert.ok(c >= 0 && c <= o.h, `${o.name} cut`);
      }
      assert.deepEqual(doc.objects.filter((o) => o.seats).map((o) => o.name).sort(),
        ["chair-down", "chair-left", "chair-right", "chair-up", "cafe-stool", "moss-sofa", "reading-armchair", "terracotta-sofa"].sort());
    });
    it("names real chairs in every table's seat slots", () => {
      let slots = 0;
      for (const o of doc.objects.filter((p) => p.seatSlots)) {
        for (const s of o.seatSlots!) { assert.ok(by.get(s.chair)?.seats, `${o.name} slot chair ${s.chair}`); slots++; }
      }
      assert.ok(slots >= 16, `slots ${slots}`);
    });
    it("records the scale: per-object in the scaled atlas, 5.0 in the unscaled one", () => {
      for (const o of doc.objects) {
        assert.ok(o.recommendedScale > 0 && Math.abs(o.scaleVsS2 - 5 / o.recommendedScale) < 0.001, o.name);
        assert.equal(o.scale, doc.scaled ? o.recommendedScale : 5);
      }
    });
  });
}
