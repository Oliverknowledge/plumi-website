/**
 * Whether a question is one a student measures the printed picture for, so a ruler helps: a deterministic list of wordings, read off the part's opening words (`x`). It errs towards
 * saying nothing: a ruler offered on a question that is a calculation from numbers already given, or that only talks about measuring, teaches a student to ignore it. Pure.
 *
 * Counted:
 *  - an instruction to measure: "Measure the length of side x", "Using Figure 16, measure the distance along the river", "by measuring, work out the perimeter" (a clause that STARTS
 *    with Measure, with a length-like word after it; never "explain how to measure the diameter", "measured the volume", "measuring cylinder", "which two measurements");
 *  - "use a ruler" ("ruler and compasses" is a construction and is not); "scale bar"; "scale drawing", "scale diagram", "drawn to scale"; "scale 1 : 200 000" or "scale of 1 : 50 000" on a diagram,
 *    drawing, grid or plan; "actual size", "real size", "image size", "drawing size", "size of the image"; "using the scale", "the scale on the map"; an answer "to the nearest mm / cm";
 *  - "calculate the magnification" (of a cell, an image: not "produced by the lens" from the equation), or "magnification" WITH a picture to work from ("Fig. 4.1", "photomicrograph", "this image",
 *    "the drawing", "scale bar"): a question that only names the word ("which describes magnification and resolution", "eyepiece lens magnification of x10") is not;
 *  - a length, width, height, diameter or distance asked for "in mm / cm" where the question points at a picture ("Figure", "diagram", "drawing", "photograph", "line", "grid", "map").
 * A bare "scale" is never enough (a scale of 1 to 5, economies of scale, the Richter scale, scale factor, large-scale), nor is a map's scale with the measured distance given in the words
 * ("7 cm on the map"). A protractor is not here: this is a straight edge.
 */
const LENGTHY = "(?:length|lengths|width|distance|height|diameter|radius|size|perimeter|thickness|depth|gap|circumference|side)";
/** A clause that starts with "Measure" (after the start, a full stop, a bracket or a comma: "Using Figure 16, measure the distance"), then a length-like word. "to measure", "scientists measure" are not. */
const MEASURE = new RegExp(`(?:^|[.?!:]\\s+|\\)\\s+|,\\s+)measure\\b[^.?!]{0,60}\\b${LENGTHY}\\b`, "i");
const BY_MEASURING = /(?:^|[.?!]\s+)by measuring,/i;
/** "Describe the shape of the valley and measure the width": measuring joined on to an instruction. */
const AND_MEASURE = new RegExp(`\\b(?:describe|state|calculate|use|draw|work out|find|give)\\b[^.?!]{0,80}\\band measure\\b[^.?!]{0,60}\\b${LENGTHY}\\b`, "i");
/** "Calculate the magnification of the B lymphocyte": the student reads the picture. Not a lens's magnification from the equation or from numbers given. */
const CALC_MAG = /\b(?:calculate|work out|determine|find)\b[^.?!]{0,15}\bthe magnification\b(?! produced)(?! of the (?:lens|microscope))/i;
const PICTURE = /\b(?:figure|fig\.?|diagram|drawing|photograph|photo|image|picture|line|grid|map|shape|triangle|rectangle)\b/i;
/** An instruction that asks for a length "in mm / cm": "Work out the actual distance ... Give your answer in cm" ("The student used a ruler to measure the diameter in mm" is a description). */
const INMM = new RegExp(`(?:^|[.?!]\\s+)(?:\\([a-z]\\)\\s+)?(?:calculate|work out|find|give|determine|write down|state|what is)\\b[^.?!]{0,60}\\b${LENGTHY}\\b[^.?!]{0,50}\\bin (?:mm|cm|millimetres?|centimetres?)\\b`, "i");
/** "Magnification" with something printed to read it from. */
const MAGNIFICATION = /\bmagnification\b/i;
const A_PICTURE = /\b(?:fig(?:ure)?\.? ?\d|photomicrograph|micrograph|photograph|drawing|diagram|scale bar|this image|the image (?:below|shown|above)|image below|shown (?:below|above))\b/i;

const SIMPLE: RegExp[] = [
  /\b(?:use|using) (?:a |your )?ruler\b(?! and compass)/i,
  /\bscale bar\b/i,
  /\bto scale\b/i,
  /\b(?:actual|real|image|drawing) size\b/i,
  /\busing the scale\b/i,
  /\bthe scale (?:on|of) the (?:map|drawing|diagram|photograph|image|picture)\b/i,
  /\b(?:give|write|measure|draw|answer)[^.?!]{0,50}\bto the nearest (?:mm|cm|millimetre|centimetre)s?\b/i,
];
/** "Scale 1 : 200 000" or "scale of 1 : 50 000" on a drawing the student reads. A map whose scale comes with the distance already measured ("... is 7 cm on the map") is a calculation. */
const RATIO = /\bscale(?: of)?:? 1 ?: ?\d/i;
const GIVEN = /\b\d+(?:\.\d+)? ?(?:cm|mm|centimetres?|millimetres?) (?:on|apart on) the (?:map|plan|drawing)\b|\b(?:on the (?:map|plan|drawing)),? the (?:distance|length)[^.?!]{0,40}\bis \d/i;

/** Drawing a scale drawing is a task on paper, not a picture to read ("construct a scale drawing", "make an accurate scale drawing of the plan"). */
const DRAW_TASK = /\b(?:make|construct|draw)\b[^.?!]{0,25}\bscale (?:drawing|diagram)\b/i;
const SCALE_PICTURE = /\bscale (?:drawing|diagram)\b/i;
/** Numbers already given for the magnification or the drawing: "image width 40 mm, real width 0.1 mm", "a rectangle measuring 10 cm by 18 cm". */
const NUMBERS_GIVEN = /\b(?:image|real|actual) (?:width|length|size|height)\b[^.?!]{0,30}\b(?:was|is) \d|\bmeasuring \d+(?:\.\d+)? ?(?:cm|mm)\b|\b\d+(?:\.\d+)? ?(?:cm|mm) (?:by|x|\u00d7) \d/i;
/** Ruler used as an instrument of an investigation (uncertainty, graduations), not to read a picture. */
const RULER_INSTRUMENT = /\b(?:uncertainty|graduations|percentage error|accurate to)\b/i;

export function needsRuler(words: string | undefined): boolean {
  if (!words) return false;
  // "Diagram not drawn to scale", "Not to scale", "not drawn accurately": a disclaimer that the picture must NOT be measured.
  const t = words.replace(/\s+/g, " ").replace(/\b(?:(?:has|have) )?(?:been )?not (?:been )?(?:drawn )?(?:to scale|accurately)\b/gi, " ");
  if (NUMBERS_GIVEN.test(t) && !/\bfig(?:ure)?\.? ?\d|\bphotomicrograph|\bscale bar\b/i.test(t)) return false;
  if (SCALE_PICTURE.test(t) && !DRAW_TASK.test(t)) return true;
  if (SIMPLE.some((r) => r.test(t) && !(RULER_INSTRUMENT.test(t) && /ruler/i.test(r.source)))) return true;
  if (MEASURE.test(t) || BY_MEASURING.test(t) || AND_MEASURE.test(t)) return true;
  if (CALC_MAG.test(t) && !/\bmagnification = ?(?:image|size of image)/i.test(t)) return true;
  if (MAGNIFICATION.test(t) && A_PICTURE.test(t)) return true;
  if (RATIO.test(t) && !GIVEN.test(t) && !DRAW_TASK.test(t) && /\b(?:diagram|drawing|grid|plan|map extract)\b/i.test(t)) return true;
  if (INMM.test(t) && PICTURE.test(t)) return true;
  return false;
}
