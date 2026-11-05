import index from "@/content/questionBankInsights/index.json";
import { cleanInsights, formMap, type Insights } from "./insights";
import type { Form } from "./questionForm";

/**
 * Topic analysis data, loaded only when it is asked for. The subject's file (src/content/questionBankInsights/<slug>.json, about 30 KB) is a separate chunk made by the dynamic
 * import below, so no other page of the study app carries it. `index.json` (a few bytes, one line per subject) is all that is read to know whether a subject has an analysis, and it
 * names the parts file the analysis was built from: a bank cut again under a new hash stops offering it until the analysis is built again (scripts/question-bank/build-insights.ts).
 */
const have = index as Record<string, string>;

/** Whether the subject has an analysis that was built from the data the student is looking at (`partsHash` is the hash in the subject's meta). */
export const hasInsights = (slug: string, partsHash: string | undefined): boolean => !!partsHash && Object.prototype.hasOwnProperty.call(have, slug) && have[slug] === partsHash;

export interface Loaded { data: Insights; forms: ReadonlyMap<string, Form> }
const loads = new Map<string, Promise<Loaded>>();
const done = new Map<string, Loaded>();
/** The analysis if it has already arrived this visit (a place that mounts after it has loaded starts with it, not on a loading frame). */
export const peekInsights = (slug: string): Loaded | null => done.get(slug) ?? null;

/** The subject's analysis, once per visit. A failure is forgotten, so asking again tries again. */
export function getInsights(slug: string): Promise<Loaded> {
  let p = loads.get(slug);
  if (!p) {
    p = !/^[a-z0-9-]+$/.test(slug) || slug === "index" || !Object.prototype.hasOwnProperty.call(have, slug)
      ? Promise.reject(new Error("no analysis"))
      : import(`@/content/questionBankInsights/${slug}.json`).then((m: { default: unknown }) => {
        const data = cleanInsights(m.default);
        if (!data || data.slug !== slug) throw new Error("not an analysis");
        const got = { data, forms: formMap(data) };
        done.set(slug, got);
        return got;
      });
    loads.set(slug, p);
    p.catch(() => loads.delete(slug));
  }
  return p;
}
