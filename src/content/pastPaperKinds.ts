/**
 * The kinds of file a past paper session can have, in the order they are shown, and how each reads. A light file of its own (no paper data) so the
 * study app's Papers view draws the same keys as the public library (src/components/pastPapers/PaperTable.tsx) without loading the library.
 */
export const fileKinds = ["qp", "ms", "er", "ins", "gt"] as const;
export type FileKind = (typeof fileKinds)[number];

export const fileKindLabel: Record<FileKind, { short: string; long: string }> = {
  qp: { short: "QP", long: "Question paper" },
  ms: { short: "MS", long: "Mark scheme" },
  er: { short: "ER", long: "Examiner\u2019s report" },
  ins: { short: "Insert", long: "Insert" },
  gt: { short: "GT", long: "Grade thresholds" },
};
