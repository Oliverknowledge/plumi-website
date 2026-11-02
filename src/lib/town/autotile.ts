import { hash2 } from "./rng";

/**
 * The ground's edge pieces (docs/study/art/town/README.md). A piece named `edge_X` has the other material (path, plaza) on side X and grass opposite;
 * `outer_C` has it as a minor piece in corner C; `inner_C` has GRASS as the minor piece in corner C. Pieces are PLACED ON THE GRASS TILES
 * ring around a fill region F (their "other" half faces the fill), so for a tile outside F:
 *
 *     one 4-neighbour in F (X)            -> edge_X
 *     two adjacent 4-neighbours (X, Y)    -> inner_<the corner opposite both>      (N and E in F: grass is the minor piece in SW)
 *     none, one diagonal in F (C)         -> outer_C
 *
 * Anything else (opposite neighbours, three or more, two lone diagonals) has no piece: the mask is too thin there (`cleanMask` fixes
 * them, `maskProblems` reports what is left).
 */
export type Cls = `edge_${"N" | "E" | "S" | "W"}` | `outer_${"NE" | "NW" | "SE" | "SW"}` | `inner_${"NE" | "NW" | "SE" | "SW"}`;
export type Mask = (tx: number, ty: number) => boolean;

const OPP: Record<string, string> = { NE: "SW", NW: "SE", SE: "NW", SW: "NE" };

export function classOf(inF: Mask, tx: number, ty: number): Cls | "none" | "invalid" {
  const n = inF(tx, ty - 1), e = inF(tx + 1, ty), s = inF(tx, ty + 1), w = inF(tx - 1, ty);
  const c4 = +n + +e + +s + +w;
  if (c4 === 0) {
    const d: string[] = [];
    if (inF(tx + 1, ty - 1)) d.push("NE");
    if (inF(tx - 1, ty - 1)) d.push("NW");
    if (inF(tx + 1, ty + 1)) d.push("SE");
    if (inF(tx - 1, ty + 1)) d.push("SW");
    if (d.length === 0) return "none";
    return d.length === 1 ? (`outer_${d[0]}` as Cls) : "invalid";
  }
  if (c4 === 1) return (`edge_${n ? "N" : e ? "E" : s ? "S" : "W"}`) as Cls;
  if (c4 === 2 && !(n && s) && !(e && w)) {
    const present = `${n ? "N" : "S"}${e ? "E" : "W"}`;      // the corner the two neighbours make: N and E in F -> NE
    return `inner_${OPP[present]}` as Cls;
  }
  return "invalid";
}

/** Grows the mask until every tile outside it has a piece: closes one-tile gaps and notches, removes one-tile spurs. At most `rounds` passes. */
export function cleanMask(m: Uint8Array, cols: number, rows: number, rounds = 12): Uint8Array {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && m[y * cols + x] === 1;
  for (let r = 0; r < rounds; r++) {
    let changed = false;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (m[i] === 1) {
        const c4 = +at(x, y - 1) + +at(x + 1, y) + +at(x, y + 1) + +at(x - 1, y);
        if (c4 <= 1) { m[i] = 0; changed = true; }
        continue;
      }
      const c = classOf(at, x, y);
      if (c === "invalid") { m[i] = 1; changed = true; }
    }
    if (!changed) break;
  }
  return m;
}

/** The tiles that still have no piece. */
export function maskProblems(m: Uint8Array, cols: number, rows: number): [number, number][] {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && m[y * cols + x] === 1;
  const out: [number, number][] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!at(x, y) && classOf(at, x, y) === "invalid") out.push([x, y]);
  return out;
}

export interface EdgeSets { [set: string]: { [cls: string]: { id: string; alternates: string[] } } }

/** The piece id for a class in a set, an alternate chosen by position when the sheet drew the class twice. */
export function pieceId(sets: EdgeSets, set: "plaza" | "dirt", cls: Cls, seed: number, tx: number, ty: number): string {
  const e = sets[set][cls];
  const all = [e.id, ...e.alternates];
  return all[Math.floor(hash2(seed, tx, ty) * all.length)];
}
