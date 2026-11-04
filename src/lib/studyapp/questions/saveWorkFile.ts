"use client";

import { getAnswerImage } from "./answerImage";
import { hasAnn, hasInk, type QSet, type QuestionsData } from "./model";
import { questionWithMarks } from "./annotImage";
import { workFileName, workHtml } from "./saveWork";
import { keyOf } from "./model";

/**
 * The page's own handwriting face (Caveat, the latin part: next/font may rename the family) as a font-face the saved file carries inside it, so the typed answers look the same wherever the file is opened (a computer without
 * a handwriting font would show a plain serif). Looked up in the page's own stylesheets; "" if it cannot be found or read (the file then falls back to the handwriting fonts the device has).
 */
async function handwritingFont(): Promise<string> {
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const r of Array.from(rules)) {
        if (!(r instanceof CSSFontFaceRule)) continue;
        const family = r.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
        if (!/caveat/i.test(family) || !/U\+0000-00FF/i.test(r.style.getPropertyValue("unicode-range"))) continue;
        const m = /url\(["']?([^"')]+)["']?\)/.exec(r.style.getPropertyValue("src"));
        if (!m) continue;
        const res = await fetch(new URL(m[1], sheet.href ?? location.href).href);
        if (!res.ok) return "";
        const blob = await res.blob();
        if (blob.size > 150_000) return "";
        const data = await new Promise<string>((ok, no) => { const f = new FileReader(); f.onload = () => ok(String(f.result)); f.onerror = () => no(f.error); f.readAsDataURL(blob); });
        return `@font-face{font-family:"Plumi Hand";font-weight:600;src:url(${data.replace(/^data:[^;,]*/, "data:font/woff2")}) format("woff2")}`;
      }
    }
  } catch { /* the device's own handwriting fonts are used */ }
  return "";
}

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
    const blob = new Blob([workHtml(set, q.answers, images, new Date(), onQuestion, await handwritingFont())], { type: "text/html;charset=utf-8" });
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
