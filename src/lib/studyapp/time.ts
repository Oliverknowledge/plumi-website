/**
 * "Today" is a London day, as on the iPad (streaks and the week are counted in UK time), whatever the
 * browser's own zone. Dates are ISO calendar days (YYYY-MM-DD); nothing here keeps a clock of its own.
 */
const TZ = "Europe/London";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false });
const longFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const shortFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short" });
const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });

/** The London calendar day of an instant. */
export const dayOf = (ms: number) => dayFmt.format(ms);
/** Noon UTC of an ISO day: a safe instant to do day arithmetic from (never near a DST edge). */
const noon = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
export const addDays = (iso: string, n: number) => new Date(noon(iso) + n * 86_400_000).toISOString().slice(0, 10);
/** Whole days from `a` to `b` (positive when b is later). */
export const daysBetween = (a: string, b: string) => Math.round((noon(b) - noon(a)) / 86_400_000);
export const weekdayShort = (iso: string) => shortFmt.format(noon(iso));
export const shortDate = (iso: string) => dateFmt.format(noon(iso));
export const longDate = (ms: number) => longFmt.format(ms);
export const hourOf = (ms: number) => Number(hourFmt.format(ms)) % 24;

/** "Good morning." and so on, by the London hour. */
export function greeting(ms: number): string {
  const h = hourOf(ms);
  return h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
}
/** Daylight art until six, the evening room after. */
export const isEvening = (ms: number) => { const h = hourOf(ms); return h >= 18 || h < 5; };

/** A due date as the to-do list says it: today, a weekday this week, a date after, or overdue. */
export function dueLabel(dueISO: string, todayISO: string): string {
  const d = daysBetween(todayISO, dueISO);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d < 7) return weekdayShort(dueISO);
  return shortDate(dueISO);
}

/** The instant a London day begins (midnight in UK time, so 23:00 UTC the evening before in summer). `iso` is YYYY-MM-DD. */
export function startOfDay(iso: string): number {
  const utc = noon(iso) - 12 * 3_600_000;
  for (const back of [3_600_000, 0]) {
    const t = utc - back;
    if (dayOf(t) === iso && dayOf(t - 1) !== iso) return t;
  }
  return utc;
}
/** The first day of the week (Monday, as in the UK) that holds `iso`. */
export function weekStartOf(iso: string): string {
  const dow = new Date(noon(iso)).getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
}
