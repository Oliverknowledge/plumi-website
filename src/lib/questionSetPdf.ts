import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { isChoice } from "@/lib/markBands";
import { bankOwner, earlierToRead, fetchBankData, bankTitle, paperName, partImage, questionOf, reportKey, seriesLabel, stemImage, type BankPart, type BankSubject, type EarlierParts } from "@/content/questionBank";

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
 * browser would hand that cached copy to fetch() and block it.
 *
 * Encoded with toDataURL, which pdf-lib takes as is: toBlob is throttled to about a
 * second a call while the tab is in the background, so a big set built while someone
 * looks at another tab would crawl.
 */
type Slice = { bytes: string; w: number; h: number; ruled: boolean };
const PRINT_W = A4.w - MARGIN * 2;
const PRINT_H = A4.h - MARGIN * 2 - 40;

/**
 * A crop up to SHRINK pages tall goes on one page, a little smaller. A taller one (economics'
 * extracts run to three pages) is cut into page-sized slices, each cut made at a blank row as
 * far back as half a page, so no line of text is split and a graph or diagram, which has no
 * blank row in it, moves whole to the next page (a maths graph was cut in two, 29 October 2026).
 */
const SHRINK = 1.4;
/** `reading`: a part that's there to read (`earlierToRead`), so it stops above its own lines to write on. */
async function asJpeg(url: string, reading = false): Promise<Slice[] | null> {
  const res = await paced(url);
  if (!res) return null;
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
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rows = readRows(pixels);
  const ruled = hasAnswerLines(pixels, rows);
  const words = writingStarts(pixels, rows) ?? rows.foot + 8;
  const height = reading && words >= 40 ? Math.min(canvas.height, words) : canvas.height; // a crop that is nearly all lines stays whole
  const cutOut = (top: number, bottom: number) => {
    const piece = document.createElement("canvas");
    piece.width = canvas.width;
    piece.height = bottom - top;
    piece.getContext("2d")?.drawImage(canvas, 0, top, canvas.width, bottom - top, 0, 0, canvas.width, bottom - top);
    return { bytes: piece.toDataURL("image/jpeg", 0.88), w: piece.width, h: piece.height, ruled };
  };
  if (height <= pageRows * SHRINK) return [height === canvas.height ? { bytes: canvas.toDataURL("image/jpeg", 0.88), w: canvas.width, h: canvas.height, ruled } : cutOut(0, height)];
  const blank = (row: number) => ctx.getImageData(0, row, canvas.width, 1).data.every((v, i) => i % 4 === 3 || v > 235);
  const slices: Slice[] = [];
  for (let top = 0; top < height;) {
    let cut = Math.min(height, top + pageRows);
    if (cut < height) {
      const floor = cut - Math.floor(pageRows * 0.5);
      let r = cut;
      while (r > floor && !blank(r)) r -= 2;
      if (r > floor) cut = r;
    }
    slices.push(cutOut(top, cut));
    top = cut;
  }
  return slices;
}

/** A crop's pixels (an ImageData). */
export type Pixels = { data: ArrayLike<number>; width: number; height: number };
type Rule = { top: number; end: number; from: number; to: number };
type Rows = { rules: Rule[]; foot: number };

/** The rules across a crop (a few pixels tall, across most of its width, solid or dotted) and the row its ink ends at. */
function readRows({ data, width: w, height: h }: Pixels): Rows {
  const rules: Rule[] = [];
  let run = 0, foot = 0, from = 0, to = 0;
  for (let y = 0; y <= h; y++) {
    let ruleRow = false;
    if (y < h) {
      let first = -1, last = -1, ink = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i] + data[i + 1] + data[i + 2] < 600) { if (first < 0) first = x; last = x; ink++; }
      }
      if (ink) foot = y + 1;
      ruleRow = last - first >= w * 0.7 && ink >= (last - first) * 0.3;
      if (ruleRow) { from = first; to = last; }
    }
    if (ruleRow) run++;
    else { if (run && run <= 4) rules.push({ top: y - run, end: y, from, to }); run = 0; }
  }
  return { rules, foot };
}

/**
 * Two rules that are lines to write on: the same width, nothing between them. A table's rows have sides and words
 * between their rules, and a box above "(Total for Question 2 = 12 marks)" is narrower than the rule under it
 * (Edexcel History's essays looked like two lines and would have lost theirs).
 */
function twoLines({ data, width: w }: Pixels, a: Rule, b: Rule) {
  const gap = b.end - a.end;
  if (gap < 14 || gap > 90 || Math.abs(a.from - b.from) > w * 0.015 || Math.abs(a.to - b.to) > w * 0.015) return false;
  for (let y = a.end + 1; y < b.top - 1; y++) for (let x = Math.max(a.from, b.from); x <= Math.min(a.to, b.to); x++) {
    const i = (y * w + x) * 4;
    if (data[i] + data[i + 1] + data[i + 2] < 600) return false;
  }
  return true;
}

/**
 * Whether a crop already has the paper's own lines to write on (many cutters keep them: OCR's and AQA's sciences,
 * Edexcel Psychology's one-part questions), so the PDF adds none under it: three or more rules evenly spaced, or
 * the two a 1-mark part gets, at its foot (AQA's: the PDF put two more under them, 4 November 2026). A box's border
 * (Edexcel English Literature) or a lone "Answer ____" line isn't, and a table's rules span only the table.
 */
export function hasAnswerLines(pixels: Pixels, { rules, foot }: Rows = readRows(pixels)) {
  for (let i = 2; i < rules.length; i++) {
    const a = rules[i - 1].end - rules[i - 2].end, b = rules[i].end - rules[i - 1].end;
    if (a >= 14 && b >= 14 && a <= 90 && b <= 90 && Math.abs(a - b) <= Math.max(a, b) * 0.25) return true;
  }
  const n = rules.length;
  return n >= 2 && foot - rules[n - 1].end <= 70 && twoLines(pixels, rules[n - 2], rules[n - 1]);
}

/**
 * The row a crop's closing lines to write on start at, with a label beside the first ("1 ____"), or null if it
 * doesn't close with some. Words on the left under them may be the next part's setup, so those keep the crop whole;
 * a mark or a question's total on the right ("(2)") goes with the lines.
 */
export function writingStarts(pixels: Pixels, { rules, foot }: Rows = readRows(pixels)) {
  const { data, width: w } = pixels;
  let i = rules.length - 1;
  if (i < 1 || foot - rules[i].end > 70 || !twoLines(pixels, rules[i - 1], rules[i])) return null;
  const inkIn = (y: number, from: number, to: number) => {
    let ink = 0;
    for (let x = from; x < to; x++) { const n = (y * w + x) * 4; if (data[n] + data[n + 1] + data[n + 2] < 600) ink++; }
    return ink;
  };
  // (a speck is the rule's own edge, a row below it: AQA's 8464B1F June 2025 06.2)
  for (let y = rules[i].end; y < foot; y++) if (inkIn(y, 0, Math.floor(w * 0.6)) > w * 0.01) return null;
  const gap = rules[i].end - rules[i - 1].end;
  while (i > 0 && twoLines(pixels, rules[i - 1], rules[i]) && Math.abs(rules[i].end - rules[i - 1].end - gap) <= gap * 0.25) i--;
  // The first line's label, left of where the line starts, goes with it; anything reaching over the line is words.
  const { top, from } = rules[i];
  let start = top;
  for (let y = top - 1; y > Math.max(0, top - 30) && !inkIn(y, from, w); y--) if (inkIn(y, 0, from)) start = y;
  return Math.max(0, start - 3); // the rows just above a rule are its faint edge
}

/**
 * The file host (R2's public r2.dev address) turns a burst of a couple of hundred requests
 * away for a few seconds, without CORS headers, so fetch() sees only a failure: a big set
 * lost a third of its pages. So requests start at most one every PACE ms, and after a
 * failure every request waits, longer each time (1, 2, 4, 8, 16 s), before trying again.
 */
const PACE = 70;
let nextStart = 0;
let coolOff = 0;
async function paced(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const now = Date.now();
    const at = Math.max(nextStart, coolOff, now);
    nextStart = at + PACE;
    if (at > now) await new Promise(r => setTimeout(r, at - now));
    const res = await fetch(url, { mode: "cors", cache: "no-store" }).catch(() => null);
    if (res?.ok) return res;
    if (res?.status === 404) return null; // not there: waiting won't help
    coolOff = Math.max(coolOff, Date.now() + 1000 * 2 ** attempt);
  }
  return null;
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

/** Runs of list numbers as ranges: "1–3", "1, 3", "2–4, 7". */
function ranges(nums: Iterable<number>) {
  const runs: number[][] = [];
  for (const n of [...new Set(nums)].sort((x, y) => x - y)) {
    const last = runs.at(-1);
    if (last && n === last[last.length - 1] + 1) last.push(n); else runs.push([n]);
  }
  return runs.map(r => (r.length > 1 ? `${r[0]}–${r[r.length - 1]}` : `${r[0]}`)).join(", ");
}

/**
 * Ruled lines to answer on, as a paper gives (Discord, 2 November 2026): two a mark, at least two and at most
 * forty (a 20-mark essay gets a page and a half; a longer one goes on paper), 24 pt apart. None under a
 * multiple-choice question, whose answer is a letter.
 */
const LINE_GAP = 24;
const linesFor = (p: BankPart) => (p.k ? 0 : Math.min(40, Math.max(2, Math.round((p.m ?? 2) * 2))));
const RULE = rgb(0.78, 0.74, 0.7);
/** How big an earlier part, there to be read, is drawn: a paper's 11 pt comes to about 8 pt. */
const READ_SCALE = 0.75;
const READ_INDENT = 10;

/**
 * The set as one A4 PDF: a title, each question with a one-line label ("3 · June 2023 ·
 * Paper 1 · Q01.4 · 1 mark", numbered as on the page it came from) and its crop at
 * print size, then, if asked, the mark schemes and the examiner's reports in the same
 * order: each question's report once, after its last part's scheme. Questions keep the
 * order they were picked in, so the PDF reads as the list on screen did.
 *
 * `earlierFrom` is the bank's parts: a later part picked without the ones before it gets them to read, as the
 * page's "Show question 5 so far" does ("particle X" is described in 03.2, and 03.3 only names it; a student
 * found a PDF of 03.3 alone couldn't be answered, 4 November 2026). They go in once, above the first part that
 * needs them, smaller and without their lines to write on: every part's own copy made a 20-part topic set of
 * 21 pages 37, and this makes it 28. They aren't numbered, marked, or given a scheme.
 */
export async function buildSetPdf(subject: BankSubject, picked: BankPart[], opts: {
  markSchemes: boolean; reports?: boolean; lines?: boolean; earlierFrom?: BankPart[]; numbers?: Map<string, number>; onProgress?: (done: number, total: number) => void;
}): Promise<number> {
  const parts = [...picked];
  const reports: Record<string, string> = opts.reports ? await fetchBankData<Record<string, string>>(subject, "reports").then(r => r ?? {}).catch(() => ({})) : {};
  let skipped = 0;
  let unread = 0; // earlier parts that couldn't be fetched: said in the count, but they alone don't fail the PDF
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
  const newPage = () => { page = pdf.addPage([A4.w, A4.h]); footer(page); y = A4.h - MARGIN; };

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
  pending = { title: `${bankTitle(subject)}: ${parts.length} ${parts.length === 1 ? "question" : "questions"}`, sub: marks ? `${marks} ${marks === 1 ? "mark" : "marks"}` : undefined };

  // Every crop the PDF needs, in the order it's drawn, fetched six at a time from the start.
  // `quiet` is an earlier part after the first of its run, whose label already covers it (it shows again over a page).
  type Crop = { part: BankPart; kind: "qp" | "ms" | "stem" | "earlier"; label: string; quiet?: boolean; last?: boolean };
  const crops: Crop[] = [];
  const msCrops = new Map<BankPart, Crop>();
  const run = limited(6);
  const fetched = new Map<Crop, ReturnType<typeof asJpeg>>();
  const want = (c: Crop) => {
    const url = c.kind === "stem" ? stemImage(c.part, subject.cropVersion) : partImage(c.part.id, c.kind === "earlier" ? "qp" : c.kind, subject.cropVersion);
    fetched.set(c, run(() => asJpeg(url, c.kind === "earlier").catch(() => null)));
    return c;
  };

  async function place({ kind, label, part, quiet, last }: Crop, slices: Awaited<ReturnType<typeof asJpeg>>) {
    if (kind === "qp" || kind === "ms") {
      done += 1;
      opts.onProgress?.(done, total);
    }
    if (!slices) {
      if (kind === "qp" || kind === "ms") skipped += 1;
      if (kind === "earlier") unread += 1;
      return;
    }
    const reading = kind === "earlier";
    for (const [n, img] of slices.entries()) {
      const jpg = await pdf.embedJpg(img.bytes);
      let w = reading ? PRINT_W * READ_SCALE : PRINT_W;
      let h = (img.h / img.w) * w;
      if (h > PRINT_H) { h = PRINT_H; w = (img.w / img.h) * h; }
      const above = pending ? headingHeight(pending) : 0;
      const silent = quiet && !n;
      if (y - above - h - (silent ? 0 : 16) < MARGIN + 10 && y < A4.h - MARGIN) {
        page = pdf.addPage([A4.w, A4.h]);
        footer(page);
        y = A4.h - MARGIN;
      }
      if (pending) { drawHeading(pending); pending = null; }
      if (!silent || y >= A4.h - MARGIN) {
        const text = n ? `${label} (continued)` : label;
        const size = Math.min(9.5, (9.5 * PRINT_W) / bold.widthOfTextAtSize(text, 9.5));
        page.drawText(text, { x: MARGIN, y: y - 10, size, font: bold, color: reading ? SOFT : INK });
        y -= 16;
      }
      // A rule down the side sets what's there to read apart from the questions to answer.
      if (reading) page.drawLine({ start: { x: MARGIN + 1, y }, end: { x: MARGIN + 1, y: y - h }, thickness: 1.5, color: RULE });
      page.drawImage(jpg, { x: reading ? MARGIN + READ_INDENT : MARGIN, y: y - h, width: w, height: h });
      y -= h + (reading && !last ? 6 : GAP);
    }
    if (kind === "qp" && opts.lines && !slices.some(s => s.ruled)) {
      // The lines start under the crop and carry on over the page if they must, as a paper's do.
      y += GAP / 2;
      for (let n = linesFor(part); n > 0; n--) {
        if (y - LINE_GAP < MARGIN + 10) newPage();
        y -= LINE_GAP;
        page.drawLine({ start: { x: MARGIN + 18, y }, end: { x: A4.w - MARGIN, y }, thickness: 0.6, color: RULE });
      }
      y -= GAP;
    }
  }

  const num = (p: BankPart) => (opts.numbers?.has(p.id) ? `${opts.numbers.get(p.id)} · ` : "");
  const labelFor = (p: BankPart) => `${num(p)}${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)} · Q${p.l}${p.m != null ? ` · ${p.m} ${p.m === 1 ? "mark" : "marks"}` : ""}`;
  // Each question's start (its setup, before part .1) goes in once, above its first part, headed with the numbers
  // it is for ("For 26–27 · June 2024 · AS Paper 1 · question 2"): numbered like a part, it read as one (Discord,
  // 1 November 2026). A start several questions share (AQA Economics: a context's extracts, for questions 01–04)
  // goes in once for them all.
  const stemsDone = new Set<string>();
  const stemFor = new Map<string, number[]>();
  for (const p of parts) if (p.st && opts.numbers?.has(p.id)) stemFor.set(stemImage(p), [...(stemFor.get(stemImage(p)) ?? []), opts.numbers.get(p.id)!]);
  const earlier = opts.earlierFrom ? earlierToRead(parts, opts.earlierFrom) : new Map<string, EarlierParts>();
  for (const p of parts) {
    const stem = stemImage(p);
    if (p.st && !stemsDone.has(stem)) {
      stemsDone.add(stem);
      const covers = stemFor.has(stem) ? `For ${ranges(stemFor.get(stem)!)} · ` : "";
      crops.push(want({ part: p, kind: "stem", label: `${covers}${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)} · start of question ${questionOf(p.l)}` }));
    }
    const read = earlier.get(p.id);
    if (read) {
      const nums = read.needs.flatMap(x => opts.numbers?.get(x.id) ?? []);
      const label = `${nums.length ? `For ${ranges(nums)} · ` : ""}Question ${questionOf(p.l)} so far, to read, not to answer · ${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)}`;
      read.parts.forEach((part, i) => crops.push(want({ part, kind: "earlier", label, quiet: i > 0, last: i === read.parts.length - 1 })));
    }
    crops.push(want({ part: p, kind: "qp", label: labelFor(p) }));
  }
  if (opts.markSchemes) for (const p of parts) if (p.ms && !isChoice(p)) msCrops.set(p, want({ part: p, kind: "ms", label: `Mark scheme · ${labelFor(p)}` }));
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
    const covers = reportNums.get(key)?.length ? `${ranges(reportNums.get(key)!)} · ` : "";
    page.drawText(`${covers}Examiner's report · ${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)} · ${q}`, { x: MARGIN, y: y - 10, size: 9.5, font: bold, color: INK });
    y -= 22;
    for (const l of lines) {
      if (y - lead < MARGIN + 10) newPage();
      if (l.text) page.drawText(l.text, { x: MARGIN, y: y - size, size, font: l.head ? bold : font, color: l.head ? INK : SOFT });
      y -= l.text ? lead : lead / 2;
    }
    y -= GAP / 2;
  }

  // Multiple-choice answers go in a grid, four to a row ("12 · Q3  B"), even where the board's scheme row
  // exists (OCR's): a set of 30 of them was a page and a half of one-letter answers.
  let keys: BankPart[] = [];
  function flushKeys() {
    if (!keys.length) return;
    const cols = 4, colW = (A4.w - MARGIN * 2) / cols, rowH = 18;
    for (let i = 0; i < keys.length; i += cols) {
      if (y - rowH < MARGIN + 10) newPage();
      if (pending) { drawHeading(pending); pending = null; }
      keys.slice(i, i + cols).forEach((p, c) => {
        const x = MARGIN + c * colW;
        const n = opts.numbers?.get(p.id);
        const tag = `${n != null ? `${n} · ` : ""}Q${p.l}`;
        page.drawText(tag, { x, y: y - 12, size: 9.5, font, color: SOFT });
        page.drawText(plain(p.k ?? ""), { x: x + font.widthOfTextAtSize(tag, 9.5) + 8, y: y - 12, size: 11, font: bold, color: INK });
      });
      y -= rowH;
    }
    y -= GAP / 2;
    keys = [];
  }

  if (opts.markSchemes || opts.reports) {
    // The schemes (and reports) start on a fresh page, their heading drawn with the first one.
    if (y < A4.h - MARGIN) newPage();
    const allKeys = parts.every(p => isChoice(p));
    pending = { title: opts.markSchemes && opts.reports ? "Mark schemes and examiner's reports" : opts.markSchemes ? (allKeys ? "Answers" : "Mark schemes") : "Examiner's reports" };
    for (const p of parts) {
      const c = opts.markSchemes ? msCrops.get(p) : undefined;
      if (c) { flushKeys(); await drawn(c); }
      else if (opts.markSchemes && p.k) keys.push(p);
      if (opts.reports && reportAfter.get(reportKey(subject, p.id)) === p) { flushKeys(); drawReport(p); }
    }
    flushKeys();
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
  return skipped + unread;
}
