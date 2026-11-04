/**
 * Where a question's pictures are. The same addresses `partImage` and `stemImage` in content/questionBank.ts make
 * (cropUrls.test.ts holds them equal), written out here because that file imports every subject's data and the study
 * app's pages should not carry it.
 */
import { papersBase } from "@/config/papers";

export { papersBase };
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

/**
 * The bank's lists for a subject (`parts`, `text`, `reports`) live on R2 under their content hash, the same names `bankDataUrl` in content/questionBank.ts makes (cropUrls.test.ts holds them
 * equal). The hashes come with the subject's meta (`SubjectMeta.data`); null where the subject has no such file (no reports, say), so the caller degrades without an error.
 */
export type BankDataHashes = Readonly<Record<string, string | undefined>> | undefined;
export const bankFile = (slug: string, data: BankDataHashes, file: "parts" | "text" | "reports"): string | null => {
  const h = data?.[file];
  return typeof h === "string" && /^[\w-]{4,64}$/.test(h) ? `${papersBase}/bank-data/${slug}/${file}.${h}.json` : null;
};

/** The topic tree and names for a subject (src/app/study/(app)/questions/subjects/[subject]/route.ts). */
export const subjectFile = (slug: string) => `/study/questions/subjects/${slug}`;
