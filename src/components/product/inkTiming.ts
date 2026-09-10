import { write, strokeLength, type HandStroke } from "@/lib/hand";
import { hasSuperscript, inkRuns } from "./richInk";

/**
 * How long a block of ink takes to write.
 *
 * Lets a caller schedule what happens after it — the tutor replying, a mark
 * landing — off the ink's real path length rather than off a hard-coded number
 * that drifts the moment the copy changes.
 *
 * Kept out of `Ink.tsx` because that module is a client boundary (for payload
 * reasons — see its header) and a Server Component cannot call a function
 * exported from one. This is pure geometry and belongs on either side.
 */
export function inkDuration(
  text: string,
  size: number,
  width = 600,
  maxLines = 2,
  speed = 420,
): number {
  const strokes: HandStroke[] = hasSuperscript(text)
    ? inkRuns(text, size).flatMap((run) =>
        write(run.text, { size: run.size, box: { x: run.x, y: 0, width }, maxLines: 1 }),
      )
    : write(text, { size, box: { x: 0, y: 0, width }, maxLines });

  const total = strokes.reduce((sum, stroke) => sum + strokeLength(stroke), 0);
  return total / speed;
}
