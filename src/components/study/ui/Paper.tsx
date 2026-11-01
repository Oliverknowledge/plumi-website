import type { HTMLAttributes } from "react";
import type { PaperStockId } from "../tokens";

/**
 * Writing paper. The page is the product, and it is drawn on its own stock: it never takes the
 * look's colours, so changing look or mode can never recolour a student's work. What tells it
 * from the desk is its line and its shape (tighter on the spine side).
 *
 * The strokes themselves are the student's and the tutor's, drawn by the notebook engine, not
 * set in a font. `Caveat` (st-hand, st-work, st-tutor) is for static demonstrations only.
 */
export function Paper({
  stock = "cream", ruling = "ruled", className = "", ...rest
}: { stock?: PaperStockId; ruling?: "ruled" | "grid" | "blank" } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`st-paper ${className}`.trim()} data-stock={stock} data-ruling={ruling} {...rest} />;
}
