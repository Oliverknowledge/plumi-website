import { hasInk, hasText, type QAnswer } from "@/lib/studyapp/questions/model";

/**
 * Which of a student's three places to write is the answer Plumi should mark? It follows what they can SEE:
 *   text  the Type tab, with words in it
 *   ink   the Draw tab, with a drawing in it
 *   ann   their own writing ON the printed question (the answer lines on the paper), when the tab in front of them is empty
 * On a real paper the answer goes on the printed lines, so writing there counts. Where nothing is showing but something is hidden in the other tab,
 * that is used as a last resort (the student is shown the words and checks them before anything is marked).
 */
export type MarkSource = "text" | "ink" | "ann";

export function markSource(a: QAnswer | undefined): MarkSource | null {
  const written = hasText(a), drawn = hasInk(a), noted = (a?.ann?.n ?? 0) > 0;
  if (a?.mode === "ink" && drawn) return "ink";
  if (a?.mode === "type" && written) return "text";
  if (a?.mode === undefined) { if (written) return "text"; if (drawn) return "ink"; }
  if (noted) return "ann";
  return written ? "text" : drawn ? "ink" : null;
}
