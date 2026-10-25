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
 */
async function asJpeg(url: string): Promise<{ bytes: ArrayBuffer; w: number; h: number } | null> {
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
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", 0.88));
  return blob ? { bytes: await blob.arrayBuffer(), w: bitmap.width, h: bitmap.height } : null;
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

  async function place(part: BankPart, kind: "qp" | "ms" | "stem", label: string) {
    const img = await asJpeg(partImage(part.id, kind)).catch(() => null);
    if (kind !== "stem") {
      done += 1;
      opts.onProgress?.(done, total);
    }
    if (!img) {
      if (kind !== "stem") skipped += 1;
      return;
    }
    const jpg = await pdf.embedJpg(img.bytes);
    const maxW = A4.w - MARGIN * 2;
    const maxH = A4.h - MARGIN * 2 - 40;
    let w = maxW;
    let h = (img.h / img.w) * w;
    if (h > maxH) { h = maxH; w = (img.w / img.h) * h; }
    const above = pending ? headingHeight(pending) : 0;
    if (y - above - h - 16 < MARGIN + 10 && y < A4.h - MARGIN) {
      page = pdf.addPage([A4.w, A4.h]);
      footer(page);
      y = A4.h - MARGIN;
    }
    if (pending) { drawHeading(pending); pending = null; }
    page.drawText(label, { x: MARGIN, y: y - 10, size: 9.5, font: bold, color: INK });
    page.drawImage(jpg, { x: MARGIN, y: y - 16 - h, width: w, height: h });
    y -= 16 + h + GAP;
  }

  const labelFor = (p: BankPart) => `${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)} · Q${p.l}${p.m != null ? ` · ${p.m} ${p.m === 1 ? "mark" : "marks"}` : ""}`;
  // Each question's start (its setup, before part .1) goes in once, above its first part.
  const stemsDone = new Set<string>();
  for (const p of parts) {
    const q = `${p.p}-${p.s}-${p.l.split(".")[0]}`;
    if (p.st && !stemsDone.has(q)) {
      stemsDone.add(q);
      await place(p, "stem", `${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)} · question ${p.l.split(".")[0]}`);
    }
    await place(p, "qp", labelFor(p));
  }

  if (opts.markSchemes) {
    // The schemes start on a fresh page, their heading drawn with the first one.
    if (y < A4.h - MARGIN) {
      page = pdf.addPage([A4.w, A4.h]);
      footer(page);
      y = A4.h - MARGIN;
    }
    pending = { title: "Mark schemes" };
    for (const p of parts) {
      if (p.ms) await place(p, "ms", `Mark scheme · ${labelFor(p)}`);
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
