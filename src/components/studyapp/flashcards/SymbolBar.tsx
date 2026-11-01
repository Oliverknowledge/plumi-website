"use client";

/** The characters a chemistry, physics or maths card needs, one tap each. They go in at the cursor of the box you were typing in. */
export const SYMBOLS = ["²", "³", "⁻", "⁺", "₂", "₃", "→", "⇌", "δ+", "δ−", "Δ", "°", "×", "½", "√", "π"];

/** Insert `text` into a field's value at its cursor (or the end), returning the new value and where the cursor goes. */
export function insertAt(value: string, start: number | null, end: number | null, text: string): { value: string; caret: number } {
  const s = start ?? value.length, e = end ?? s;
  return { value: value.slice(0, s) + text + value.slice(e), caret: s + text.length };
}

export function SymbolBar({ onInsert }: { onInsert: (text: string) => void }) {
  return (
    <div className="symbar2" role="toolbar" aria-label="Symbols">
      {SYMBOLS.map((s) => (
        <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(s)} aria-label={`Insert ${s}`}>{s}</button>
      ))}
    </div>
  );
}
