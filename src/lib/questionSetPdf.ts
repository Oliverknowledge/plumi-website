import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { bankOwner, bankTitle, paperName, partImage, seriesLabel, type BankPart, type BankSubject } from "@/content/questionBank";

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
 * The set as one A4 PDF: a title, each question with a one-line label ("June 2023 ·
 * Paper 1 · Q01.4 · 1 mark") and its crop at print size, then, if asked, the mark
 * schemes in the same order. Crops never split across pages; a tall one is scaled
 * to fit. The last line of each page says where it came from, quietly.
 */
export async function buildSetPdf(subject: BankSubject, picked: BankPart[], opts: { markSchemes: boolean; onProgress?: (done: number, total: number) => void }): Promise<number> {
  // Paper order, not the order they were tapped: series (newest first), paper, question.
  const seriesRank = (s: string) => { const y = s.match(/^[A-Z]{3}(\d\d)/); return y ? Number(y[1]) * 100 + (s.startsWith("NOV") ? 11 : s.startsWith("OCT") ? 10 : 6) : 0; };
  const parts = [...picked].sort((a, b) => seriesRank(b.s) - seriesRank(a.s) || a.p.localeCompare(b.p) || a.s.localeCompare(b.s) || a.l.localeCompare(b.l, undefined, { numeric: true }));
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

  const labelFor = (p: BankPart) => `${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)} · Q${p.l}${p.m != null ? ` · ${p.m} ${p.m === 1 ? "mark" : "marks"}` : ""}`;
  // Each question's start (its setup, before part .1) goes in once, above its first part.
  const stemsDone = new Set<string>();
  for (const p of parts) {
    const q = `${p.p}-${p.s}-${p.l.split(".")[0]}`;
    if (p.st && !stemsDone.has(q)) {
      stemsDone.add(q);
      crops.push(want({ part: p, kind: "stem", label: `${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)} · question ${p.l.split(".")[0]}` }));
    }
    crops.push(want({ part: p, kind: "qp", label: labelFor(p) }));
  }
  if (opts.markSchemes) for (const p of parts) if (p.ms) msCrops.set(p, want({ part: p, kind: "ms", label: `Mark scheme · ${labelFor(p)}` }));
  const drawn = async (c: Crop) => place(c, await fetched.get(c)!);

  for (const c of crops) await drawn(c);

  if (opts.markSchemes) {
    // The schemes start on a fresh page, their heading drawn with the first one.
    if (y < A4.h - MARGIN) {
      page = pdf.addPage([A4.w, A4.h]);
      footer(page);
      y = A4.h - MARGIN;
    }
    pending = { title: "Mark schemes" };
    for (const p of parts) {
      const c = msCrops.get(p);
      if (c) await drawn(c);
      else if (p.k) {
        if (y - 20 < MARGIN + 10) { page = pdf.addPage([A4.w, A4.h]); footer(page); y = A4.h - MARGIN; }
        if (pending) { drawHeading(pending); pending = null; }
        page.drawText(`${labelFor(p)}: answer ${p.k}`, { x: MARGIN, y: y - 12, size: 10.5, font: bold, color: INK });
        y -= 24;
      }
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
