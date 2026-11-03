/** The characters a typed maths or science answer needs, one tap each, and the plain-text sub and superscripts (Unicode, no LaTeX). */
export const SYMBOLS: readonly { ch: string; name: string }[] = [
  { ch: "²", name: "squared" }, { ch: "³", name: "cubed" }, { ch: "⁻¹", name: "to the power minus one" }, { ch: "₂", name: "subscript 2" },
  { ch: "½", name: "one half" }, { ch: "¼", name: "one quarter" }, { ch: "¾", name: "three quarters" }, { ch: "√", name: "square root" },
  { ch: "π", name: "pi" }, { ch: "°", name: "degrees" }, { ch: "±", name: "plus or minus" }, { ch: "×", name: "times" }, { ch: "÷", name: "divide" },
  { ch: "≈", name: "approximately" }, { ch: "≤", name: "less than or equal" }, { ch: "≥", name: "greater than or equal" }, { ch: "→", name: "arrow" },
  { ch: "Δ", name: "delta" }, { ch: "θ", name: "theta" }, { ch: "µ", name: "mu" },
];

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ", n: "ₙ" };

/** Raise what can be raised; anything else is left as typed. */
export const toSup = (s: string) => Array.from(s, (c) => SUP[c] ?? c).join("");
export const toSub = (s: string) => Array.from(s, (c) => SUB[c] ?? c).join("");
/** Insert `text` at the selection of a field's value, returning the new value and where the cursor goes. */
export function insertAt(value: string, start: number | null, end: number | null, text: string): { value: string; caret: number } {
  const s = start ?? value.length, e = end ?? s;
  return { value: value.slice(0, s) + text + value.slice(e), caret: s + text.length };
}
