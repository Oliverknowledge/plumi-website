/**
 * Where a question's pictures are. The same addresses `partImage` and `stemImage` in content/questionBank.ts make
 * (cropUrls.test.ts holds them equal), written out here because that file imports every subject's data and the study
 * app's pages should not carry it.
 */
/**
 * Where the pictures are served from: NEXT_PUBLIC_PAPERS_URL if set, otherwise (in any built site, a Vercel preview included)
 * the public R2 bucket, so a preview deployment without the variable still shows the pictures; `next dev` keeps /papers-local.
 */
export const papersBase = (process.env.NEXT_PUBLIC_PAPERS_URL ?? (process.env.NODE_ENV === "production" ? "https://pub-e8a9dbab8e2a4d089f52b2a45e0d0b50.r2.dev" : "/papers-local")).replace(/\/$/, "");
const MS_VERSION = 2;

export function partImage(id: string, kind: "qp" | "ms" | "stem", version?: number): string {
  const v = kind === "ms" ? Math.max(MS_VERSION, version ?? 0) : version;
  return (kind === "stem" ? `${papersBase}/bank/${id.replace(/-[^-]+$/, "")}-stem.webp` : `${papersBase}/bank/${id}-${kind}.webp`) + (v ? `?v=${v}` : "");
}

/** A part's start (`st`): its question's, or the one it shares (`sk`). */
export const stemImage = (p: { id: string; sk?: string }, version?: number): string =>
  p.sk ? `${papersBase}/bank/${p.sk}-stem.webp${version ? `?v=${version}` : ""}` : partImage(p.id, "stem", version);

/** An examiner's report covers a whole question ("74051-jun23-01"); an Edexcel question is its own key. */
export const reportKey = (byQuestion: boolean, id: string) => (byQuestion ? id : id.split("-").slice(0, 3).join("-"));

/** The bank's lists for a subject, fetched by the browser from `public/question-bank/<slug>/`. */
export const bankFile = (slug: string, file: "parts" | "text" | "reports") => `/question-bank/${slug}/${file}.json`;

/** The topic tree and names for a subject (src/app/study/(app)/questions/subjects/[subject]/route.ts). */
export const subjectFile = (slug: string) => `/study/questions/subjects/${slug}`;
