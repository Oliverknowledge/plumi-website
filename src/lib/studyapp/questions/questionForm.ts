/**
 * The form of a question part: the way an examiner asks it (Recall it, Describe it, Explain it, Calculate it, ...), read off the part's own words.
 * It is for the Topic analysis (how a topic has been asked in the papers Plumi holds) and nothing else. It is NOT marking and never decides a mark.
 *
 * Pure and deterministic: the same words give the same form, with no model and no network. It is conservative on purpose: a part that does not
 * clearly say what it asks for is "other", never a guess, so a count of a form is a count of parts that really say so.
 *
 * Input: the part's question text as the bank holds it (lower case, folded: the question cut out of the page's text), its marks, and the bank's multiple-choice key if it has one.
 *
 * The rules, in the order they are applied:
 *
 *  1. CHOICE. The bank gives a part an answer key (`k`: A to D) only when it is a multiple-choice question. That is the only way a part is
 *     "choice"; the wording is never used for it.
 *  2. COMMAND WORDS. Examiners put the command word first in its sentence ("Explain why ...") or after a lead-in ("Using the graph, suggest ...")
 *     or after "and" ("State two enzymes and describe their functions"). So a command word counts only in those places, in the last two
 *     sentences of the question (the setup above is context, not the ask). Calculate, draw, sketch, plot and "complete the ..." count anywhere in the last three sentences, because OCR text of a diagram runs into the ask. A verb in the middle of a sentence ("... to calculate the ...") does not count.
 *       calculate  calculate, work out
 *       evaluate   evaluate, compare, contrast, discuss, assess, analyse, "to what extent"
 *       suggest    suggest, predict, deduce, justify, infer, propose, "what conclusion"
 *       explain    explain, "why ...?" as a sentence, "give an explanation", "account for"
 *       describe   describe, outline (and "outline why" is explain)
 *       draw       draw, sketch, plot, complete, fill in, annotate, add ... to the, shade, circle, ring, put a ring
 *       recall     state, name, give, identify, which, what, label, tick, select, choose, define, list, write down, how many, how much
 *  3. PRECEDENCE. When one question asks for more than one ("Explain why ... and calculate ..."), the more demanding word wins, in this order:
 *     calculate, evaluate, suggest, explain, describe, draw, recall. ("State and describe" is a describe; "Complete the table and calculate" is a calculate.)
 *  4. EXTENDED. A part worth 6 or more marks is an extended response (OCR marks these by levels), unless it asks for a calculation or to draw or complete
 *     something: those stay what they are. This is by marks, whatever the words, because that is how the paper treats them.
 *  5. OTHER. Anything else: a part with no command word in a place that counts (a gap-fill paragraph, a table to fill with nothing said, "Use the graph to
 *     estimate ...") is other. Unsure is other.
 */

export type Form = "choice" | "recall" | "describe" | "explain" | "calculate" | "suggest" | "evaluate" | "draw" | "extended" | "other";

/** The forms in the order they are shown: how much the part asks of the student, then the ones that are not about that. */
export const FORMS: readonly Form[] = ["recall", "choice", "describe", "explain", "calculate", "suggest", "evaluate", "draw", "extended", "other"];

/** What a student reads for each form (a few plain words; the count and the marks are drawn beside it). */
export const FORM_NAMES: Record<Form, string> = {
  choice: "Multiple choice",
  recall: "Recall",
  describe: "Describe",
  explain: "Explain",
  calculate: "Calculate",
  suggest: "Suggest or predict",
  evaluate: "Compare or evaluate",
  draw: "Draw or complete",
  extended: "Extended response",
  other: "Other",
};

export const isForm = (v: unknown): v is Form => typeof v === "string" && (FORMS as readonly string[]).includes(v);

export interface FormInput {
  /** The question's own words, lower case, as `questionText` gives them. */
  text: string;
  marks: number | null | undefined;
  /** The bank's multiple-choice key (A to D), if the part has one. */
  key?: string | null;
}

/** Higher number wins when a question asks for more than one thing. */
const RANK: Partial<Record<Form, number>> = { calculate: 7, evaluate: 6, suggest: 5, explain: 4, describe: 3, draw: 2, recall: 1 };

type Rule = [RegExp, Form];
/**
 * Each pattern is tried at the start of a clause (after labels are stripped), so it begins at the command word. `\b` ends keep "named" from being "name".
 * The first rule that fits a clause decides that clause.
 */
const RULES: Rule[] = [
  [/^(?:draw|make) (?:a |an )?(?:valid |suitable )?conclusions?\b/, "suggest"],
  [/^(?:calculate|work out)\b/, "calculate"],
  [/^(?:evaluate|compare|contrast|discuss|assess|analyse|analyze|to what extent)\b/, "evaluate"],
  [/^(?:suggest|predict|deduce|justify|infer|propose|what conclusion|what (?:can|do) (?:you|we) (?:conclude|deduce|infer)|what can be (?:concluded|deduced|inferred))\b/, "suggest"],
  [/^outline (?:why|the reasons?|the reason)\b/, "explain"],
  [/^(?:explain|account for|give an explanation|give one explanation|give a reason for|why)\b/, "explain"],
  [/^(?:describe|outline)\b/, "describe"],
  [/^(?:draw|sketch|plot|complete|fill in|annotate|shade|circle|ring|put a ring|add (?:a|an|the|two|one)? ?\w* ?(?:to|on|onto) the)\b/, "draw"],
  [/^(?:state|name|give|identify|which|what|label|tick|select|choose|define|list|write down|how many|how much|put a tick|place a tick|place ticks|put ticks|write)\b/, "recall"],
];

/**
 * A few command words are used for nothing else in an exam question, so they count wherever they stand in the last three sentences (a diagram's labels run into the
 * ask without a full stop: "... c h o h draw two circles on the diagram ..."). They do not count after a word that makes them a thing the student is not being told to
 * do ("the student could describe", "to calculate", "the plot of"), and "complete" and "tick" only before what is to be completed or ticked.
 */
const ANYWHERE: Rule[] = [
  [/\bcalculate\b/, "calculate"],
  [/\bproduce (?:a|an) (?:\w+ )?(?:diagram|graph|drawing|table|chart)\b/, "draw"],
  [/\b(?:draw|sketch|plot)\b(?! (?:a )?conclusions?\b)/, "draw"],
  [/\bcomplete (?:the|this|these|each|your|a|an|all)\b/, "draw"],
  [/\b(?:draw|make) (?:a )?conclusions?\b/, "suggest"],
];
/**
 * Command words that are an ask when they are followed by what is to be explained, described and so on, and stand in the LAST sentence (the ask is the end of the question, and
 * a sentence of the setup that says "the authors explain how ..." is earlier). Same guard as above.
 */
const ENDING: Rule[] = [
  [/\buse\b[^.?!]{0,70}?\bto (?:calculate|work out)\b/, "calculate"],
  [/\buse\b[^.?!]{0,70}?\bto (?:evaluate|compare|contrast|assess|discuss)\b/, "evaluate"],
  [/\buse\b[^.?!]{0,70}?\bto (?:suggest|predict|deduce|justify)\b/, "suggest"],
  [/\buse\b[^.?!]{0,70}?\bto explain\b/, "explain"],
  [/\buse\b[^.?!]{0,70}?\bto describe\b/, "describe"],
  [/\bevaluate (?:the|how|whether|if)\b/, "evaluate"],
  [/\bsuggest (?:why|how|one|two|three|an?|what|which|the|reasons?)\b/, "suggest"],
  [/\bexplain (?:how|why|what|whether|the|your|fully)\b/, "explain"],
  [/\b(?:describe|outline) (?:how|what|the|one|two|three|your|an?)\b/, "describe"],
  [/\bidentify (?:the|two|one|three|and|which|what)\b/, "recall"],
  [/\b(?:state|name) (?:the|one|two|three|what|why|how)\b/, "recall"],
];
/** The word before a match that makes it not an instruction. */
const NOT_ASKED = /(?:^|\s)(?:to|can|could|would|will|should|may|might|must|the|a|an|their|his|her|its|of|by|how|why|who|which|that|has|have|had|is|are|was|were|be|been)\s+$/;

/** Words that may stand before a command word in the same sentence: "using the graph, suggest ...", "from the information, explain ...". */
const LEAD = /^(?:using|use|from|with reference|referring|in terms of|by|for|based on|considering|given|looking at|with the help|in your answer|in the space|on the)\b/;

/** A label or number at the start of a clause: "(ii)", "(c)*", "19", "4.1", "*". Not a bare letter: "a" and "b" are words in a multiple-choice list, never here. */
const LABEL = /^(?:\(\s*[a-z]{1,4}\s*\)\s*\*?|\d+(?:\.\d+)?\*?|\*)\s*/;

const tidy = (t: string): string => t.toLowerCase().replace(/\s+/g, " ").trim();

/** The marks printed at the end of a part ("[3]") and the answer lines are not words of the ask. */
const stripEnd = (t: string): string => t.replace(/\[\s*\d+\s*(?:marks?)?\s*\]\s*$/, "").trim();

function stripLabels(s: string): string {
  let out = s.trim();
  for (let i = 0; i < 6; i++) {
    const next = out.replace(LABEL, "");
    if (next === out) break;
    out = next.trim();
  }
  return out;
}

/** Abbreviations whose full stop is not the end of a sentence. */
const ABBREV = /\b(fig|figs|e\.g|i\.e|etc|approx|vol|cf|eqn)\./g;
/** Sentences that tell the student how to write the answer, not what to do: they are not the ask and do not hide it. */
const FORMAT = /^(?:give|express|write|show|state) (?:your|the|each|all) (?:answers?|working|workings|results?|values?)\b|^show your (?:working|workings)\b|^you may use\b|^use the (?:space|table) (?:below|opposite)\b/;
const QUOTES = /^[\u201c\u201d\u2018\u2019\u201b"'`]+/;

/** The last `n` sentences of the question that are part of the ask (answer-format sentences and the marks left out). */
function lastSentences(text: string, n: number): string[] {
  const body = stripEnd(tidy(text)).replace(ABBREV, "$1");
  return body.split(/(?<=[.?!][\u201d\u2019"']?)\s+/).map((x) => stripLabels(x.replace(QUOTES, "").trim())).filter((x) => x && !FORMAT.test(x)).slice(-n);
}

/** Two or more one-letter or one-digit words in a row: the labels of a diagram or the letters of an answer line that run into the ask ("a b name the cells"). */
const JUNK_RUN = /(?:^|\s)(?:[a-z0-9]\s+){2,}(?=[a-z]{3})/g;
/** A part label inside a sentence ("... stage s (i) state the names ..."): the ask starts after it. */
const INNER_LABEL = /\(\s*(?:i{1,3}|iv|v|vi{0,3}|[a-h])\s*\)\s*\*?\s*/g;
/** A figure or table caption that runs into the ask ("fig 6.3 explain how ..."): the ask starts after it. */
const CAPTION = /\b(?:fig|figs|figure|table)\s*\d+(?:\.\d+)?(?:\s*\(\s*[a-z]\s*\))?\s+(?=[a-z])/g;

/** Marks a clause that starts inside a sentence: there, "which" and "what" are only joining words, so they are not asks. */
const SUB = "\u0001";

/** Where the ask may start inside one stretch of words: the stretch itself, and what follows a label, a caption, a run of diagram letters or a lead-in. */
function starts(s: string): string[] {
  const out: string[] = [s];
  for (const re of [INNER_LABEL, CAPTION, JUNK_RUN]) for (const m of s.matchAll(re)) out.push(s.slice((m.index ?? 0) + m[0].length));
  for (const m of s.matchAll(/\)\s+(?=[a-z])/g)) out.push(SUB + s.slice((m.index ?? 0) + m[0].length));
  return out;
}

/** The clauses where a command word may stand, from the last three sentences of the question. */
export function clauses(text: string): string[] {
  const out: string[] = [];
  for (const sentence of lastSentences(text, 3)) {
    for (const s of starts(sentence)) {
      const plain = s.startsWith(SUB) ? s.slice(1) : s;
      out.push(s);
      // "using the graph, suggest ...": the ask after a lead-in; "use the table to explain ...": the ask after "to"
      if (LEAD.test(plain)) {
        const comma = plain.indexOf(","), to = plain.indexOf(" to ");
        if (comma > 0) out.push(SUB + stripLabels(plain.slice(comma + 1)));
        if (/^use\b/.test(plain) && to > 0 && (comma < 0 || to < comma)) out.push(SUB + plain.slice(to + 4));
      }
      // "state two enzymes and describe their functions": a command word after "and" / "then" / ";"
      for (const m of plain.matchAll(/(?:\band|\bthen|;|,)\s+(?=\w)/g)) out.push(SUB + plain.slice((m.index ?? 0) + m[0].length));
    }
  }
  return out;
}

/** The form a clause asks for, or null. */
function clauseForm(raw: string): Form | null {
  const sub = raw.startsWith(SUB);
  const c = sub ? raw.slice(1) : raw;
  if (sub && /^(?:which|what|why|how many|how much)\b/.test(c)) return null;
  // "give your answer to 3 significant figures" tells the student how to write the answer; it is not a recall question
  if (/^give (?:your|the|each|all) answers?\b/.test(c)) return null;
  for (const [re, form] of RULES) if (re.test(c)) return form;
  return null;
}

/** The forms of the words that count wherever they stand (see ANYWHERE and ENDING). */
function anywhereForms(text: string): Form[] {
  const last = lastSentences(text, 3).join(" ");
  const end = lastSentences(text, 1).join(" ");
  const out: Form[] = [];
  for (const [re, form, where] of [...ANYWHERE.map(([r, f]) => [r, f, last] as const), ...ENDING.map(([r, f]) => [r, f, end] as const)]) {
    const g = new RegExp(re.source, "g");
    for (const m of where.matchAll(g)) {
      if (!NOT_ASKED.test(where.slice(0, m.index ?? 0))) { out.push(form); break; }
    }
  }
  return out;
}

/** The form the question's words ask for (the most demanding command word in the places that count), or null if none. */
export function commandForm(text: string): Form | null {
  let best: Form | null = null;
  const see = (f: Form | null) => { if (f && (best === null || (RANK[f] ?? 0) > (RANK[best] ?? 0))) best = f; };
  for (const c of clauses(text)) see(clauseForm(c));
  for (const f of anywhereForms(text)) see(f);
  return best;
}

export function classifyForm(p: FormInput): Form {
  if (p.key && /^[A-D]$/.test(p.key)) return "choice";
  const said = commandForm(p.text);
  if (typeof p.marks === "number" && p.marks >= 6 && said !== "calculate" && said !== "draw") return "extended";
  return said ?? "other";
}
