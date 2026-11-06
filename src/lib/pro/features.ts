/**
 * What Plumi Pro includes on the website: one entry for each Pro feature, read by the Settings plan list and used as the id for analytics and for `<ProGate>`.
 * To add a Pro feature, add one entry here (docs/study/pro.md has the five-step checklist). Keep `line` to one short line, in plain words: no price, no
 * "cheaper", nothing that links to buying (Pro is bought only in the iPad app, and Apple's rules say the website must not point there).
 */
export interface ProFeature {
  /** Stable: used in analytics (`pro_locked_tapped`) and as the `feature` of `<ProGate>`. Never reuse or rename one. */
  id: string;
  title: string;
  line: string;
  /** live: works on the website today. soon: planned, shown as such. */
  status: "live" | "soon";
}

export const PRO_FEATURES = [
  { id: "mark-scheme-decks", title: "Mark scheme decks", line: "The exam boards’ own mark schemes, deck by deck.", status: "live" },
] as const satisfies readonly ProFeature[];

export type ProFeatureId = (typeof PRO_FEATURES)[number]["id"];

export const proFeature = (id: string): ProFeature | undefined => (PRO_FEATURES as readonly ProFeature[]).find((f) => f.id === id);
