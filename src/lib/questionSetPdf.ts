import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { bankDataPath, bankOwner, bankTitle, paperName, partImage, questionOf, reportKey, seriesLabel, type BankPart, type BankSubject } from "@/content/questionBank";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 40;
const GAP = 18;
const INK = rgb(0.29, 0.23, 0.21);
const SOFT = rgb(0.48, 0.4, 0.36);

/**
 * pdf-lib embeds PNG and JPEG, not WebP, so each crop is redrawn through a canvas.
 *
 * Fetched with no-store: the page has usually shown the crop already through an <img>,
 * which the file host answers without CORS headers (and without Vary: Origin), and the
 * browser would hand that cached copy to fetch() and block it. One retry for a blip.
 *
 * Encoded with toDataURL, which pdf-lib takes as is: toBlob is throttled to about a
 * second a call while the tab is in the background, so a big set built while someone
 * looks at another tab would crawl.
 */
type Slice = { bytes: string; w: number; h: number };
const PRINT_W = A4.w - MARGIN * 2;
const PRINT_H = A4.h - MARGIN * 2 - 40;

/**
 * A crop taller than a page at full width (economics' extracts run to three pages) is cut
 * into page-sized slices rather than shrunk to fit, each cut made at a blank row nearby so
 * no line of text is split.
 */
async function asJpeg(url: string): Promise<Slice[] | null> {
  let res = await fetch(url, { mode: "cors", cache: "no-store" }).catch(() => null);
  if (!res?.ok) res = await fetch(url, { mode: "cors", cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pageRows = Math.floor((canvas.width * PRINT_H) / PRINT_W);
  if (canvas.height <= pageRows * 1.15) return [{ bytes: canvas.toDataURL("image/jpeg", 0.88), w: canvas.width, h: canvas.height }];
  const blank = (row: number) => ctx.getImageData(0, row, canvas.width, 1).data.every((v, i) => i % 4 === 3 || v > 235);
  const slices: Slice[] = [];
  for (let top = 0; top < canvas.height;) {
    let cut = Math.min(canvas.height, top + pageRows);
    if (cut < canvas.height) {
      const floor = cut - Math.floor(pageRows * 0.2);
      let r = cut;
      while (r > floor && !blank(r)) r -= 2;
      if (r > floor) cut = r;
    }
    const piece = document.createElement("canvas");
    piece.width = canvas.width;
    piece.height = cut - top;
    piece.getContext("2d")?.drawImage(canvas, 0, top, canvas.width, cut - top, 0, 0, canvas.width, cut - top);
    slices.push({ bytes: piece.toDataURL("image/jpeg", 0.88), w: piece.width, h: piece.height });
    top = cut;
  }
  return slices;
}

/**
 * Runs jobs a few at a time, in the order they were handed over. Used to fetch crops
 * ahead of where the PDF has got to, so a set of hundreds doesn't wait on each in turn.
 */
function limited(width: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(job: () => Promise<T>): Promise<T> => {
    if (active >= width) await new Promise<void>(r => waiting.push(r));
    active += 1;
    try { return await job(); } finally { active -= 1; waiting.shift()?.(); }
  };
}

/**
 * Helvetica draws WinAnsi only: anything else in a report (≥, →, Greek) becomes its
 * nearest plain form, or goes.
 */
const PLAIN: Record<string, string> = { "≥": ">=", "≤": "<=", "≠": "!=", "→": "->", "←": "<-", "−": "-", "‐": "-", "‑": "-", "√": "sqrt", "≈": "~", "∆": "delta", "Δ": "delta", "θ": "theta", "λ": "lambda", "μ": "u", "π": "pi", "Ω": "ohm", "\u00a0": " " };

/**
 * The set as one A4 PDF: a title, each question with a one-line label ("3 · June 2023 ·
 * Paper 1 · Q01.4 · 1 mark", numbered as on the page it came from) and its crop at
 * print size, then, if asked, the mark schemes and the examiner's reports in the same
 * order: each question's report once, after its last part's scheme. Questions keep the
 * order they were picked in, so the PDF reads as the list on screen did.
 */
export async function buildSetPdf(subject: BankSubject, picked: BankPart[], opts: {
  markSchemes: boolean; reports?: boolean; numbers?: Map<string, number>; onProgress?: (done: number, total: number) => void;
}): Promise<number> {
  const parts = [...picked];
  const reports: Record<string, string> = opts.reports ? await fetch(bankDataPath(subject.slug, "reports")).then(r => r.json()).catch(() => ({})) : {};
  let skipped = 0;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${bankTitle(subject)} questions`);
  pdf.setCreator("Plumi question bank (tryplumi.app)");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const total = parts.length * (opts.markSchemes ? 2 : 1);
  let done = 0;

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;
  const footer = (p: typeof page) =>
    p.drawText(`${bankTitle(subject)} · questions © ${bankOwner(subject)} · tryplumi.app/question-bank`, { x: MARGIN, y: 22, size: 8, font, color: SOFT });
  footer(page);

  // A heading waits to be drawn with the first crop under it, so it never sits alone at the foot of a page.
  type Heading = { title: string; sub?: string };
  let pending: Heading | null = null;
  const headingHeight = (h: Heading) => (h.sub ? 56 : 40);
  function drawHeading(h: Heading) {
    page.drawText(h.title, { x: MARGIN, y: y - 18, size: 18, font: bold, color: INK });
    if (h.sub) page.drawText(h.sub, { x: MARGIN, y: y - 36, size: 11, font, color: SOFT });
    y -= headingHeight(h);
  }
  const marks = parts.reduce((n, p) => n + (p.m ?? 0), 0);
  pending = { title: `${bankTitle(subject)}: ${parts.length} ${parts.length === 1 ? "question" : "questions"}`, sub: marks ? `${marks} marks` : undefined };

  // Every crop the PDF needs, in the order it's drawn, fetched six at a time from the start.
  type Crop = { part: BankPart; kind: "qp" | "ms" | "stem"; label: string };
  const crops: Crop[] = [];
  const msCrops = new Map<BankPart, Crop>();
  const run = limited(6);
  const fetched = new Map<Crop, ReturnType<typeof asJpeg>>();
  const want = (c: Crop) => { fetched.set(c, run(() => asJpeg(partImage(c.part.id, c.kind, subject.cropVersion)).catch(() => null))); return c; };

  async function place({ kind, label }: Crop, slices: Awaited<ReturnType<typeof asJpeg>>) {
    if (kind !== "stem") {
      done += 1;
      opts.onProgress?.(done, total);
    }
    if (!slices) {
      if (kind !== "stem") skipped += 1;
      return;
    }
    for (const [n, img] of slices.entries()) {
      const jpg = await pdf.embedJpg(img.bytes);
      let w = PRINT_W;
      let h = (img.h / img.w) * w;
      if (h > PRINT_H) { h = PRINT_H; w = (img.w / img.h) * h; }
      const above = pending ? headingHeight(pending) : 0;
      if (y - above - h - 16 < MARGIN + 10 && y < A4.h - MARGIN) {
        page = pdf.addPage([A4.w, A4.h]);
        footer(page);
        y = A4.h - MARGIN;
      }
      if (pending) { drawHeading(pending); pending = null; }
      page.drawText(n ? `${label} (continued)` : label, { x: MARGIN, y: y - 10, size: 9.5, font: bold, color: INK });
      page.drawImage(jpg, { x: MARGIN, y: y - 16 - h, width: w, height: h });
      y -= 16 + h + GAP;
    }
  }

  const num = (p: BankPart) => (opts.numbers?.has(p.id) ? `${opts.numbers.get(p.id)} · ` : "");
  const labelFor = (p: BankPart) => `${num(p)}${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)} · Q${p.l}${p.m != null ? ` · ${p.m} ${p.m === 1 ? "mark" : "marks"}` : ""}`;
  // Each question's start (its setup, before part .1) goes in once, above its first part. A start several
  // questions share (AQA Economics: a context's extracts, for questions 01–04) goes in once for them all.
  const stemsDone = new Set<string>();
  for (const p of parts) {
    const stem = partImage(p.id, "stem");
    if (p.st && !stemsDone.has(stem)) {
      stemsDone.add(stem);
      crops.push(want({ part: p, kind: "stem", label: `${num(p)}${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)} · question ${questionOf(p.l)}` }));
    }
    crops.push(want({ part: p, kind: "qp", label: labelFor(p) }));
  }
  if (opts.markSchemes) for (const p of parts) if (p.ms) msCrops.set(p, want({ part: p, kind: "ms", label: `Mark scheme · ${labelFor(p)}` }));
  const drawn = async (c: Crop) => place(c, await fetched.get(c)!);

  for (const c of crops) await drawn(c);

  // An examiner's report covers a whole question (in some banks, each item has its own): each goes in once,
  // after the last of its parts here. A word Helvetica can't draw is put plainly.
  const reportAfter = new Map<string, BankPart>();
  const reportNums = new Map<string, number[]>(); // the list numbers a report covers: "1–3 · Examiner's report"
  const reportLabels = new Map<string, Set<string>>(); // the parts of it picked: "11(b)"
  for (const p of parts) {
    const key = reportKey(subject, p.id);
    if (!reports[key]) continue;
    reportAfter.set(key, p);
    reportLabels.set(key, (reportLabels.get(key) ?? new Set()).add(p.l));
    const n = opts.numbers?.get(p.id);
    if (n != null) reportNums.set(key, [...(reportNums.get(key) ?? []), n]);
  }
  const plain = (text: string) => [...text].map(ch => {
    if (PLAIN[ch] !== undefined) return PLAIN[ch];
    try { font.widthOfTextAtSize(ch, 10); return ch; } catch { return ""; }
  }).join("");
  const newPage = () => { page = pdf.addPage([A4.w, A4.h]); footer(page); y = A4.h - MARGIN; };
  function drawReport(p: BankPart) {
    const key = reportKey(subject, p.id);
    if (reportAfter.get(key) !== p) return;
    const size = 9.5, lead = 13, width = A4.w - MARGIN * 2;
    const lines: { text: string; head: boolean }[] = [];
    // A report headed part by part ("Question 11(a)", Pearson's) keeps only the parts picked, and what comes before the first heading.
    let paras = reports[key].split(/\n{2,}/).map(t => plain(t.trim())).filter(Boolean);
    const picked = reportLabels.get(key)!;
    let under: string | null = null;
    const ours = (h: string) => [...picked].some(l => l === h || l.startsWith(`${h}(`) || h.startsWith(`${l}(`)); // "11(b)" under "11", "11(b)(i)" under "11(b)"
    const mine = paras.filter(t => { const h = t.match(/^Question (\S+)$/); if (h) under = h[1]; return under === null || ours(under); });
    if (mine.some(t => /^Question \S+$/.test(t))) paras = mine;
    for (const para of paras) {
      const head = /^Question \S+$/.test(para);
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && (head ? bold : font).widthOfTextAtSize(next, size) > width) { lines.push({ text: line, head }); line = word; } else line = next;
      }
      if (line) lines.push({ text: line, head });
      lines.push({ text: "", head: false });
    }
    if (y - 40 < MARGIN + 10) newPage();
    if (pending) { drawHeading(pending); pending = null; }
    const q = key === p.id ? `Q${p.l}` : `question ${questionOf(p.l)}`;
    // Runs of numbers as ranges: "1–3", "1, 3", "2–4, 7".
    const runs: number[][] = [];
    for (const n of [...new Set(reportNums.get(key))].sort((x, y) => x - y)) {
      const last = runs.at(-1);
      if (last && n === last[last.length - 1] + 1) last.push(n); else runs.push([n]);
    }
    const covers = runs.length ? `${runs.map(r => (r.length > 1 ? `${r[0]}–${r[r.length - 1]}` : `${r[0]}`)).join(", ")} · ` : "";
    page.drawText(`${covers}Examiner's report · ${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)} · ${q}`, { x: MARGIN, y: y - 10, size: 9.5, font: bold, color: INK });
    y -= 22;
    for (const l of lines) {
      if (y - lead < MARGIN + 10) newPage();
      if (l.text) page.drawText(l.text, { x: MARGIN, y: y - size, size, font: l.head ? bold : font, color: l.head ? INK : SOFT });
      y -= l.text ? lead : lead / 2;
    }
    y -= GAP / 2;
  }

  if (opts.markSchemes || opts.reports) {
    // The schemes (and reports) start on a fresh page, their heading drawn with the first one.
    if (y < A4.h - MARGIN) newPage();
    pending = { title: opts.markSchemes && opts.reports ? "Mark schemes and examiner's reports" : opts.markSchemes ? "Mark schemes" : "Examiner's reports" };
    for (const p of parts) {
      const c = opts.markSchemes ? msCrops.get(p) : undefined;
      if (c) await drawn(c);
      else if (opts.markSchemes && p.k) {
        if (y - 20 < MARGIN + 10) newPage();
        if (pending) { drawHeading(pending); pending = null; }
        page.drawText(`${labelFor(p)}: answer ${p.k}`, { x: MARGIN, y: y - 12, size: 10.5, font: bold, color: INK });
        y -= 24;
      }
      if (opts.reports) drawReport(p);
    }
  }

  // Nothing could be fetched (offline, or the file host refusing): don't hand over an empty PDF.
  if (skipped >= total) throw new Error("No pages could be added");
  const bytes = await pdf.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bankTitle(subject).replace(/\s+/g, "-")}-${parts.length}-questions-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return skipped;
}
