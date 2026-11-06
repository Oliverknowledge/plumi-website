import type { ProPlan } from "./client";

/**
 * What the Settings "Plumi Pro" section says about the student's plan, as plain words (plan.test.ts). Nothing here says Pro renews: the record only knows when it
 * is active until (`expires_at`), so that is all we say.
 */
export interface PlanLine { tone: "signedout" | "checking" | "later" | "pro" | "free"; headline: string; detail?: string }

/** "14 Dec", or "14 Dec 2027" when it is not this year (London time, British month names). */
export function plainDate(iso: string | undefined, now: Date = new Date()): string | null {
  const t = iso ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return null;
  const year = (d: Date) => new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Europe/London" }).format(d);
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "Europe/London", ...(year(t) !== year(now) ? { year: "numeric" } : {}) };
  return new Intl.DateTimeFormat("en-GB", o).format(t).replace("Sept", "Sep");
}

export function describePlan(plan: ProPlan, o: { signedIn: boolean; loading: boolean }, now: Date = new Date()): PlanLine {
  if (!o.signedIn) return { tone: "signedout", headline: "Sign in to see your plan" };
  if (plan.state === "unknown") return o.loading ? { tone: "checking", headline: "Checking your plan" } : { tone: "later", headline: "Couldn’t check your plan just now" };
  const d = plainDate(plan.expiresAt, now);
  if (plan.state === "pro") {
    if (!d) return { tone: "pro", headline: "You have Plumi Pro" };
    return { tone: "pro", headline: "You have Plumi Pro", detail: plan.status === "grace" ? `In a short grace period after ${d}` : `Active until ${d}` };
  }
  if ((plan.reason === "expired" || plan.reason === "revoked") && d) return { tone: "free", headline: "Free plan", detail: `Your Plumi Pro ended ${d}` };
  return { tone: "free", headline: "Free plan" };
}
