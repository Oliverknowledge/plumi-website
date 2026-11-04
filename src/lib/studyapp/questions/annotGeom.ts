import { REF_W } from "./ink";

/**
 * Where a mark is, kept so it follows the picture it is on: in the same units as an answer's ink (800 across the picture's width, the same unit down, so a picture that keeps
 * its shape keeps its marks on the same printed words however wide it is drawn: a window resized, a tablet turned, the picture enlarged). The picture's top left is (0, 0).
 */
export interface Box { left: number; top: number; width: number; height: number }

/** Units per css pixel for a picture this wide. */
export const unitsPerPx = (width: number) => REF_W / Math.max(1, width);

/** A point on the screen as a mark's coordinates: kept inside the picture (a stroke that leaves it runs along its edge). */
export function toUnits(clientX: number, clientY: number, box: Box): { x: number; y: number } {
  const k = unitsPerPx(box.width);
  return {
    x: Math.min(REF_W, Math.max(0, (clientX - box.left) * k)),
    y: Math.min(box.height * k, Math.max(0, (clientY - box.top) * k)),
  };
}

/** A mark's point on the screen, for a picture drawn in `box`. */
export function toClient(p: { x: number; y: number }, box: Box): { x: number; y: number } {
  const k = box.width / REF_W;
  return { x: box.left + p.x * k, y: box.top + p.y * k };
}

/** Where a point of the picture is as a fraction of it (0..1 across, 0..1 down), whatever size it is drawn at. */
export const fractionOf = (p: { x: number; y: number }, aspect: number) => ({ x: p.x / REF_W, y: p.y / (REF_W / aspect) });
