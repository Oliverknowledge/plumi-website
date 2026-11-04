"use client";

import { getAnswerImage } from "./answerImage";
import { hasAnn, hasInk, type QSet, type QuestionsData } from "./model";
import { questionWithMarks } from "./annotImage";
import { workFileName, workHtml } from "./saveWork";
import { keyOf } from "./model";

/** Draw the set's handwriting, build the page and hand it to the browser as a file. False if the browser would not make the file. */
/** "ok", "no-marks" (saved, but the marks drawn on the questions could not be put on their pictures), or "failed". */
export type Saved = "ok" | "no-marks" | "failed";
export async function saveWork(set: QSet, q: QuestionsData): Promise<Saved> {
  const images: Record<string, string> = {};
  for (const p of set.parts) {
    if (!hasInk(q.answers[keyOf(set.id, p.id)])) continue;
    try { const url = await getAnswerImage(p.id, { setId: set.id }); if (url) images[p.id] = url; } catch { /* that picture is left out; the rest is still saved */ }
  }
  // the questions the student marked up, with their marks on them: all at once, each given 10 seconds (left out where the picture cannot be read back, and the page says so)
  const onQuestion: Record<string, string> = {};
  const marked = set.parts.filter((p) => hasAnn(q.answers[keyOf(set.id, p.id)]));
  await Promise.all(marked.map(async (p) => {
    try { const url = await questionWithMarks(set.id, p.id, set.cv); if (url) onQuestion[p.id] = url; } catch { /* left out */ }
  }));
  const missed = marked.some((p) => !onQuestion[p.id]);
  try {
    const blob = new Blob([workHtml(set, q.answers, images, new Date(), onQuestion)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = workFileName(set);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return missed ? "no-marks" : "ok";
  } catch { return "failed"; }
}
