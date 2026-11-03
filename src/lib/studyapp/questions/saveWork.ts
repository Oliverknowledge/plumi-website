import { blocks, hasText, keyOf, markable, nameOf, type QAnswer, type QSet } from "./model";

/**
 * "Save my work": everything the student wrote in a set as one page they can keep (open, print, or file away). Typed answers as text,
 * handwriting as the pictures `getAnswerImage` draws, and the marks they gave themselves. A safety net against a browser that clears a
 * site's data, which the page cannot prevent and a student should not have to lose a week of revision to. Pure here (`workHtml`);
 * the browser part that fetches the pictures and downloads the file is `saveWork` in `saveWorkFile.ts`.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The page. `images` is a part's handwriting as a data URL, by part id. */
export function workHtml(set: QSet, answers: Record<string, QAnswer>, images: Readonly<Record<string, string>>, when: Date = new Date()): string {
  const rows: string[] = [];
  for (const b of blocks(set.parts)) {
    const small = [nameOf(set.names, b.parts[0].s) ?? b.parts[0].s, nameOf(set.names, b.parts[0].p) ?? b.parts[0].p].filter(Boolean).join(", ");
    const mine: string[] = [];
    for (const p of b.parts) {
      const a = answers[keyOf(set.id, p.id)];
      const img = images[p.id];
      const text = hasText(a) ? a!.text! : "";
      const marked = a?.got !== undefined && markable(p) ? `<p class="m">You gave yourself ${a.got} out of ${p.m}.</p>` : "";
      if (!img && !text && !marked) continue;
      mine.push(`<section><h3>${esc(p.l)}${p.m != null ? ` <small>${p.m} ${p.m === 1 ? "mark" : "marks"}</small>` : ""}</h3>${text ? `<p class="t">${esc(text).replace(/\n/g, "<br>")}</p>` : ""}${img ? `<img alt="Handwriting for ${esc(p.l)}" src="${img}">` : ""}${marked}</section>`);
    }
    if (mine.length) rows.push(`<h2>Question ${b.n}${small ? ` <small>${esc(small)}</small>` : ""}</h2>`, ...mine);
  }
  const body = rows.length ? rows.join("\n") : "<p>Nothing was written in this set.</p>";
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(set.name)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#1d2433}h1{font-size:1.5rem}h2{margin-top:2rem;font-size:1.15rem;border-bottom:1px solid #d8d2c4}h3{font-size:1rem;margin:1rem 0 .25rem}small{font-weight:400;color:#5b6170}img{max-width:100%;border:1px solid #d8d2c4;background:#fff}.t{white-space:pre-wrap}.m{color:#2f6b3f}</style></head><body>
<h1>${esc(set.name)}</h1><p><small>Saved from Plumi on ${esc(when.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}. Your marks are the ones you gave yourself.</small></p>
${body}
</body></html>`;
}

/** A file name from a set's name: letters, numbers and dashes. */
export function workFileName(set: Pick<QSet, "name">): string {
  const base = set.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${base || "my-work"}.html`;
}
