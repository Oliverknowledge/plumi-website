import { SEAT_SUBJECTS } from "@/lib/social/lobby";

/**
 * What "Start focus" starts on. The choice is the study timer's: what the student last picked, anywhere in the app,
 * stays. Until they have picked anything the answer is "no subject" (the neutral "Focus"), so the primary button is
 * always live: sitting down and pressing Start is one tap. It is not Maths (or any first subject): that would tell
 * the room a subject the student never chose.
 */

/** The subject a new focus session is started with: the last choice, else none. */
export function startSubject(chosen: string | null | undefined): string | null {
  return chosen === undefined ? null : chosen;
}

/** The word for it on the seat card: the subject, "Other" when they said so, and "Focus" when they have not chosen. */
export function subjectWord(chosen: string | null | undefined): string {
  if (chosen === undefined) return "Focus";
  return SEAT_SUBJECTS.find((s) => s.id === chosen)?.label ?? "Focus";
}
