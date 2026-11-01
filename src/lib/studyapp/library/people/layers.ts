import { decodePng } from "./png";
import type { PeopleCatalogue } from "./look";
import { SHEET_BYTES, SHEET_W, FRAME_H, SHEET_ROWS, type Layer, type LayerSource } from "./sheet";

/**
 * The iPad's layers (public/library/people-layers.bin, the app's lz_people.bin: every layer a small indexed PNG,
 * end to end, found through the catalogue's `index`). Decoded on demand, rows 0 to 2 only, and kept while the
 * page is open up to a bound (a layer is 147 KB decoded). Pure over the bytes: the browser adapter fetches them.
 */
const KEEP = 96;

export class LayerPack {
  private decoded = new Map<string, Layer>();
  private pending = new Map<string, Promise<void>>();
  private missing = new Set<string>();

  constructor(readonly catalogue: PeopleCatalogue, private bin: Uint8Array) {}

  has(key: string) { return Object.prototype.hasOwnProperty.call(this.catalogue.index, key); }

  /** What is decoded now; null for a layer not loaded (yet) or not there. */
  readonly source: LayerSource = (key) => {
    const l = this.decoded.get(key);
    if (l) { this.decoded.delete(key); this.decoded.set(key, l); }   // most recently used last
    return l ?? null;
  };

  /** Decodes these layers (the ones the pack has). Never rejects: a layer that will not decode is left out. */
  async load(keys: readonly string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.one(k)));
  }

  private one(key: string): Promise<void> {
    if (this.decoded.has(key) || this.missing.has(key) || !this.has(key)) return Promise.resolve();
    let p = this.pending.get(key);
    if (!p) {
      const [offset, length] = this.catalogue.index[key];
      p = (async () => {
        try {
          if (!(offset >= 0 && length > 0 && offset + length <= this.bin.length)) throw new Error("range");
          const bm = await decodePng(this.bin.subarray(offset, offset + length));
          if (bm.width !== SHEET_W || bm.height < SHEET_ROWS * FRAME_H) throw new Error("size");
          const layer = bm.rgba.slice(0, SHEET_BYTES);
          // Never evict a layer that is being drawn on: eviction is only of the least recently used.
          if (this.decoded.size >= KEEP) this.decoded.delete(this.decoded.keys().next().value as string);
          this.decoded.set(key, layer);
        } catch { this.missing.add(key); }
        this.pending.delete(key);
      })();
      this.pending.set(key, p);
    }
    return p;
  }
}
