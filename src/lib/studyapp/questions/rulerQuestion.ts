/**
 * Whether a question is one a student measures the printed picture for, so a ruler helps: a deterministic list of wordings, read off the part's words (the bank's full text for the part
 * where it has been loaded, else its opening words `x`). It errs towards saying nothing: a ruler offered on a question that is a calculation from numbers already given, that counts squares
 * on a grid, or that only talks about measuring, teaches a student to ignore it. Pure.
 *
 * The full text of a part is its question AND its mark scheme run together, so `questionWords` cuts it where the mark scheme starts (after the first "[2 marks]" or "[1]", or at "question
 * marking guidance", "answer mark comments", "extra information" ...) and only the question is read.
 *
 * Counted:
 *  - an instruction to measure: "Measure the length of side x", "Using Figure 16, measure the distance along the river", "By measuring, work out the perimeter", "use line PQ to measure the
 *    diameter" (a clause that STARTS with Measure, or "use ... to measure", with a length-like word after it; never "explain how to measure the diameter", "measured the volume", "measuring cylinder");
 *  - "use a ruler" ("ruler and compasses" is a construction and is not); "scale bar"; "using the scale", "the scale on the map"; "work out / determine ... the actual size / real size / image size";
 *    "calculate the actual diameter / length ..."; "how long is the tardigrade in real life"; "use Figure 14 to determine the displacement" of a figure "drawn to scale"; an answer "to the nearest mm / cm";
 *  - "calculate the magnification" (of a cell, an image: not "produced by the lens" from the equation);
 *  - a length asked for "in mm / cm" where the question points at a picture ("Figure", "diagram", "drawing", "photograph", "line", "grid", "map").
 * Not counted: a bare "scale" (a scale of 1 to 5, economies of scale, the Richter scale, scale factor), a scale drawing or diagram on a centimetre grid (the squares are counted), a drawing to
 * make with a ruler and compasses, a map's scale with the measured distance given in the words ("7 cm on the map", "PQ = 4 cm"), a "Not to scale" note, an "image magnification of x60"
 * with nothing to measure. A protractor is not here: this is a straight edge.
 */
const LENGTHY = "(?:length|lengths|width|distance|height|diameter|radius|size|perimeter|thickness|depth|gap|circumference|side|displacement)";

const MARKS = /\[\d+(?: marks?)?\]/;
const SCHEME = /\b(?:question )?(?:marking guidance|answers? mark|answer mark comments|answers? extra information|extra information|indicative content|mark scheme|additional guidance|mark comments)\b/i;
/** The question's own words: a part's full text runs the question and then its mark scheme on, so it is cut where the scheme starts (else the first 700 characters). */
export function questionWords(full: string): string {
  const t = full.replace(/\s+/g, " ");
  const m = MARKS.exec(t);
  const cuts = [m ? m.index + m[0].length : -1, t.search(SCHEME)].filter((n) => n >= 0);
  return cuts.length ? t.slice(0, Math.min(...cuts)) : t.slice(0, 700);
}

/**
 * The part's OWN words: a part's text opens with the question's stem (a method of numbered steps, "include a scale bar", "use a ruler to ensure ...") and then the part's label ("0 3 . 2",
 * "(ii)") and its question. Only the question asks the student to measure; the stem is read for context only. A label that is not found (or no label given) leaves all the words.
 */
export function ownWords(t: string, label?: string): string {
  if (!label) return t;
  let re: RegExp | null = null;
  const sci = /^(\d+)\.(\d+)$/.exec(label);
  if (sci) re = new RegExp(`\\b${sci[1].split("").join(" ?")} ?\\. ?${sci[2].split("").join(" ?")}\\b`, "gi");
  else { const g = /\(([a-z]+)\)$/i.exec(label); if (g) re = new RegExp(`\\(${g[1]}\\)`, "gi"); }
  if (!re) return t;
  let at = -1;
  for (let m = re.exec(t); m; m = re.exec(t)) at = m.index + m[0].length;
  return (at >= 0 ? t.slice(at) : t).trim();
}

const START = "(?:^|[.?!:]\\s+|\\)\\s+|,\\s+|\\b\\d+\\s+)";
/** A clause that starts with "Measure" (after the start, a full stop, a bracket or a comma: "Using Figure 16, measure the distance"), then a length-like word. "to measure", "scientists measure" are not. */
const MEASURE = new RegExp(`${START}measure\\b[^.?!]{0,60}\\b${LENGTHY}\\b`, "i");
const BY_MEASURING = new RegExp(`${START}by measuring,`, "i");
/** "Describe the shape of the valley and measure the width": measuring joined on to an instruction. */
const AND_MEASURE = new RegExp(`\\b(?:describe|state|calculate|use|draw|work out|find|give)\\b[^.?!]{0,80}\\band measure\\b[^.?!]{0,60}\\b${LENGTHY}\\b`, "i");
/** "Use line PQ to measure the diameter", "use the lipid layer to measure the diameter of HBV": an instruction, not "you could use a ruler to measure ... explain". */
const USE_TO_MEASURE = new RegExp(`${START}(?:you should |you must |you need to )?use\\b[^.?!]{0,60}\\bto measure\\b[^.?!]{0,40}\\b${LENGTHY}\\b`, "i");
/** "Calculate the magnification of the B lymphocyte": the student reads the picture. Not a lens's magnification from the equation or from numbers given. */
const CALC_MAG = /\b(?:calculate|work out|determine|find|what is)\b[^.?!]{0,15}\bthe magnification\b(?! produced)(?! of the (?:lens|microscope))/i;
/** "Calculate the actual diameter of the vascular bundle", "work out the real length of the cell": the size on the picture is measured and scaled. */
const ACTUAL = new RegExp(`\\b(?:calculate|work out|determine|find)\\b[^.?!]{0,30}\\b(?:actual|real|true)\\b[^.?!]{0,10}\\b${LENGTHY}\\b`, "i");
/** ... of something seen through a microscope or in a numbered figure (not a map's "actual distance", which a grid gives by counting). */
const MICRO = /\b(?:magnification|magnified|micrograph|microscope|photomicrograph)\b|\bfig(?:ure)?\.? ?\d/i;
/** "How long is the tardigrade in real life?" with a magnification given. */
const HOW_LONG = /\bhow (?:long|wide|tall|big|large|thick)\b[^.?!]{0,60}\b(?:real life|actually|in real)\b/i;
/** A picture whose parts are measured (not a bare "Figure 3", which may be a graph or a table). */
const PICTURE = /\b(?:diagram|drawing|photograph|photo|line|map|shape|triangle|rectangle)\b/i;
const NEAREST = /\bgive your answer to the nearest (?:mm|cm|millimetre|centimetre)s?\b/i;
/** An instruction that asks for a length "in mm / cm": "Work out the actual distance ... Give your answer in cm" ("The student used a ruler to measure the diameter in mm" is a description). */
const INMM = new RegExp(`${START}(?:\\([a-z]\\)\\s+)?(?:calculate|work out|find|give|determine|write down|state|what is)\\b[^.?!]{0,60}\\b${LENGTHY}\\b[^.?!]{0,50}\\bin (?:mm|cm|µm|μm|nm|millimetres?|centimetres?|micrometres?)\\b`, "i");
/** A figure "drawn to scale" that the student is asked to read a length or displacement from: "Use Figure 14 to determine the displacement". Drawn to scale alone is not enough. */
const TO_SCALE = /\bto scale\b/i;
const READ_FROM = new RegExp(`\\b(?:determine|work out|calculate|find|measure)\\b[^.?!]{0,40}\\b${LENGTHY}\\b`, "i");

/** "the diameter of the hurricane, shown by the line A-B": a length read off a line drawn on the figure. */
const LINE_SIZE = new RegExp(`\\b${LENGTHY}\\b[^.?!]{0,60}\\b(?:shown|labelled|marked|represented) by (?:the )?line\\b`, "i");
/** Image sizes given in the words ("the length of the image is 120 mm", "has a width of 50 mm"): the real size is a calculation. (A real size in micrometres is the opposite: the image is measured.) */
const GIVEN_SIZE = /\b(?:image|length|width|diameter|height|size|thickness)\b(?![^.?!]{0,30}\b(?:actual|real)\b)[^.?!]{0,60}\b(?:is|was|of|=) \d+(?:\.\d+)? ?(?:mm|cm)\b/i;

const SIMPLE: RegExp[] = [
  /\b(?:use|using) (?:a |your )?ruler\b(?! to (?:ensure|check|make sure|cut|draw|mark|rule))/i,
  /\b(?:use|using) (?:the |a |this )?scale bar\b|\b(?:measure|calculate|work out|find|determine|from)\b[^.?!]{0,70}\bscale bar\b|\bscale bar\b[^.?!]{0,40}\b(?:to|and) (?:measure|calculate|find|work out|determine)\b/i,
  /\b(?:calculate|work out|find|determine|measure)\b[^.?!]{0,30}\b(?:actual|real|image|drawing) size\b/i,
  /\busing the scale\b/i,
  /\bthe scale (?:on|of) the (?:map|drawing|diagram|photograph|image|picture)\b/i,
  /\b(?:measure|draw)\b[^.?!]{0,50}\bto the nearest (?:mm|cm|millimetre|centimetre)s?\b/i,
];
/** A scale drawing or diagram (no grid to count, nothing to construct) from which an actual length is worked out: the picture is measured against its scale. */
const SCALE_PICTURE = /\bscale (?:drawing|diagram)\b/i;
/** ... or a map with its scale written "1 cm represents 50 km". */
const MAP_SCALE = /\bscale:? ?(?:of )?1 ?(?:cm|centimetre)\b/i;
const ASK_ACTUAL = /\b(?:work out|find|calculate)\b[^.?!]{0,30}\b(?:actual|real|height|length|width|distance)\b/i;
/** "ruler and compasses" is a construction: the ruler draws, the student measures nothing. */
const CONSTRUCT = /\b(?:ruler and compass|a ruler and a pair of compass|pair of compasses|compasses)/i;
/** Numbers already given for the magnification or the drawing: "image width 40 mm, real width 0.1 mm", "a rectangle measuring 10 cm by 18 cm". */
const NUMBERS_GIVEN = /\b(?:image|real|actual) (?:width|length|size|height)\b[^.?!]{0,30}\b(?:was|is) \d|\bmeasuring \d+(?:\.\d+)? ?(?:cm|mm)\b|\b\d+(?:\.\d+)? ?(?:cm|mm) (?:by|x|×) \d|\b\d+(?:\.\d+)? ?(?:cm|mm|centimetres?|millimetres?) (?:on|apart on) the (?:map|plan|drawing)\b|\bon the (?:map|plan|drawing),? the (?:distance|length)[^.?!]{0,40}\bis \d/i;
/** Lengths given by letter: "PQ = 4 cm  QR = 6.5 cm" (the picture needs no ruler: "work out the scale"). */
const LABELLED = /\b[a-z]{1,3} ?= ?\d+(?:\.\d+)? ?(?:cm|mm)\b/i;
/** Ruler used as an instrument of an investigation (uncertainty, graduations), not to read a picture. */
const RULER_INSTRUMENT = /\b(?:uncertainty|graduations|percentage error|accurate to)\b/i;

/** Which wording made the question one to measure (for the tests and for judging a sample), or null. */
export function rulerRule(words: string | undefined, label?: string): string | null {
  if (!words) return null;
  // "Diagram not drawn to scale", "Not to scale", "not drawn accurately": a disclaimer that the picture must NOT be measured.
  const all = questionWords(words).replace(/\b(?:(?:has|have) )?(?:been )?not (?:been )?(?:drawn )?(?:to scale|accurately)\b/gi, " ");
  const t = ownWords(all, label);
  const instruction = MEASURE.test(t) ? "measure" : USE_TO_MEASURE.test(t) ? "use-to-measure" : BY_MEASURING.test(t) ? "by-measuring" : AND_MEASURE.test(t) ? "and-measure" : null;
  if (CONSTRUCT.test(all) && !instruction) return null;
  if (NUMBERS_GIVEN.test(all) && !/\bfig(?:ure)?\.? ?\d|\bphotomicrograph|\bscale bar\b/i.test(all)) return null;
  if (GIVEN_SIZE.test(all) && !instruction) return null;
  if (LABELLED.test(all) && !instruction && !/\b(?:use|using) (?:a |your )?ruler\b/i.test(t)) return null;
  if (instruction) return instruction;
  const calcFromFigure = /\bfig(?:ure)?\.? ?\d/i.test(all) && new RegExp(`\\bcalculate\\b[^.?!]{0,40}\\b${LENGTHY}\\b`, "i").test(t);
  const grid = /\bgrid\b/i.test(all);
  const simple = SIMPLE.findIndex((r) => r.test(t) && !(RULER_INSTRUMENT.test(t) && /ruler/i.test(r.source) && !calcFromFigure) && !(grid && /scale/.test(r.source) && !/bar/.test(r.source)));
  if (simple >= 0) return `simple-${simple}`;
  if (CALC_MAG.test(t) && !/\bmagnification = ?(?:image|size of image)/i.test(t)) return "calc-magnification";
  if (ACTUAL.test(t) && MICRO.test(all)) return "actual-size";
  if (HOW_LONG.test(t)) return "how-long";
  if (TO_SCALE.test(all) && READ_FROM.test(t)) return "to-scale";
  if (LINE_SIZE.test(t)) return "line-size";
  if (INMM.test(t) && PICTURE.test(all)) return "in-mm";
  if ((SCALE_PICTURE.test(all) || (/\bmap\b/i.test(all) && MAP_SCALE.test(all))) && !/\b(?:grid|squares|compass(?:es)?|construct|draw)\b/i.test(all) && ASK_ACTUAL.test(t)) return "scale-drawing";
  if (NEAREST.test(t) && PICTURE.test(all)) return "nearest";
  return null;
}
export const needsRuler = (words: string | undefined, label?: string): boolean => rulerRule(words, label) !== null;
