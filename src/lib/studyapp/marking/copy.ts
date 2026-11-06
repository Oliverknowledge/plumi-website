import type { Outcome } from "./api";

/**
 * What a student reads when marking does not produce a mark. One short, calm line each; never a code, a gate or an apology for
 * the machinery. (CLAUDE.md: a title, at most one short line, no em dashes. Nothing here mentions Pro or a price: whether the end of the
 * free marks may say more is a founder decision, see docs/study/ai-marking-consent-and-policy-draft.md, question 7.)
 */
const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/London" });

export function lineFor(o: Exclude<Outcome, { kind: "marked" }>, now: number = Date.now()): string {
  switch (o.kind) {
    case "signin": return "Sign in to have Plumi mark this.";
    case "consent": return "Plumi needs your OK before it marks.";
    case "allowance":
      return o.window === "day"
        ? "That is all of today’s marks. They come back at midnight."
        : `That is this week’s marks used. More on ${DAY.format(new Date(now + o.retryAfter * 1000))}.`;
    case "rate": return "One moment, then try again.";
    case "unavailable": return "Plumi can’t mark right now. Use the mark scheme instead.";
    case "cannot": return "Plumi can’t mark this one.";
    case "too_long": return "That is too long to mark here. Keep it under 2,000 characters.";
    case "unreadable": return "Plumi couldn’t read that. Try writing it a bit bigger, or type it.";
    case "failed": return "That didn’t work, and it wasn’t counted. Try again.";
  }
}
