import index from "@/content/questionBankInsights/angles.json";
import { cleanAngles, type Angles } from "./angles";

/**
 * Angles data, loaded only when a Pro student opens an Angles panel: a separate chunk (src/content/questionBankInsights/<slug>.angles.json), so a free student, and a Pro student who
 * never opens one, never fetches it. `angles.json` (a few bytes) says which subjects have it and which `parts` hash it was built from; the app offers Angles only while that matches the
 * bank's meta (scripts/question-bank/build-insights.ts keeps both in step, and `npm run bank:insights -- --check` fails in CI when they are not).
 *
 * The data is built from the public bank (its questions and mark schemes are public pictures), so showing it only to Pro is the screen's doing alone (docs/study/pro.md).
 */
const have = index as Record<string, string>;

export const hasAngles = (slug: string, partsHash: string | undefined): boolean => !!partsHash && Object.prototype.hasOwnProperty.call(have, slug) && have[slug] === partsHash;

const loads = new Map<string, Promise<Angles>>();
const done = new Map<string, Angles>();
export const peekAngles = (slug: string): Angles | null => done.get(slug) ?? null;

export function getAngles(slug: string): Promise<Angles> {
  let p = loads.get(slug);
  if (!p) {
    p = !/^[a-z0-9-]+$/.test(slug) || !Object.prototype.hasOwnProperty.call(have, slug)
      ? Promise.reject(new Error("no angles"))
      : import(`@/content/questionBankInsights/${slug}.angles.json`).then((m: { default: unknown }) => {
        const data = cleanAngles(m.default);
        if (!data || data.slug !== slug || data.built.parts !== have[slug]) throw new Error("not the angles for this bank");
        done.set(slug, data);
        return data;
      });
    loads.set(slug, p);
    p.catch(() => loads.delete(slug));
  }
  return p;
}
