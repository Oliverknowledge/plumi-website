"use client";

import { getAnswerImage } from "./answerImage";
import { hasInk, type QSet, type QuestionsData } from "./model";
import { workFileName, workHtml } from "./saveWork";
import { keyOf } from "./model";

/** Draw the set's handwriting, build the page and hand it to the browser as a file. False if the browser would not make the file. */
export async function saveWork(set: QSet, q: QuestionsData): Promise<boolean> {
  const images: Record<string, string> = {};
  for (const p of set.parts) {
    if (!hasInk(q.answers[keyOf(set.id, p.id)])) continue;
    try { const url = await getAnswerImage(p.id, { setId: set.id }); if (url) images[p.id] = url; } catch { /* that picture is left out; the rest is still saved */ }
  }
  try {
    const blob = new Blob([workHtml(set, q.answers, images)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = workFileName(set);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch { return false; }
}
