/**
 * The one written line on the Questions page while a focus session runs. `view` is the timer card's (work, paused, break); `subject` the seat card's word for what they are on
 * ("Physics"), or null for a plain focus; `clock` the chip's own face (`compactFace`). Nothing while there is no session or it is over: the page says nothing then.
 */
export function focusLine(view: "setup" | "work" | "paused" | "break" | "over", subject: string | null, clock: string): string | null {
  const on = subject ? ` on ${subject}` : "";
  if (view === "work") return `Focusing${on}, ${clock}`;
  if (view === "paused") return `Paused${on}, ${clock}`;
  if (view === "break") return `On a break, ${clock}`;
  return null;
}
