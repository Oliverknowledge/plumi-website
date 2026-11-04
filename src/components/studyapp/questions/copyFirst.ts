import type React from "react";

/**
 * The first mark or key on a faded copy of an earlier answer copies it first ("Continue here"), so the old answer never seems to vanish under the new writing.
 * A finger counts as a mark only when it draws (it scrolls the page otherwise: a drag that is only a scroll must not copy anything).
 */
export function marksOnCopy(e: Pick<React.PointerEvent, "pointerType" | "target">, fingerDraws: boolean): boolean {
  if (e.pointerType === "touch" && !fingerDraws) return false;
  return !!(e.target as Element).closest?.(".qs-canvas, textarea");
}

/** Does the finger draw (not scroll) here? The student's own choice, else a pointer that is not coarse. */
export const fingerDraws = (prefsFingerScrolls: boolean | undefined, coarse: boolean) => !(prefsFingerScrolls ?? coarse);

/**
 * A key typed into the empty box over a faded copy: the key is left to land (nothing is held back or typed again, so none is lost), the old answer is copied, and the
 * old words are put in front of what has been typed, with the caret where it was, through the box's own change event (so the box and the saved text agree and the first
 * character is never dropped).
 */
export function copyFirstOnKey(e: React.KeyboardEvent, oldText: string | undefined, copy: () => Promise<void>) {
  const box = e.target as HTMLTextAreaElement;
  if (!box.matches?.("textarea") || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
  const had = oldText?.trim() ? oldText : "";
  void copy().then(() => {
    if (!had || !box.isConnected || box.value.startsWith(had)) return;
    const caret = (box.selectionStart ?? box.value.length) + had.length;
    box.setRangeText(had, 0, 0, "preserve");
    box.setSelectionRange(caret, caret);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
