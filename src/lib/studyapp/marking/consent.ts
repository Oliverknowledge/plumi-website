/**
 * Consent to send an answer to the AI provider, recorded on the account (migration 0129 in the app repo: ai_consent_status / give /
 * withdraw; the marking function refuses without it). The wording below is a DRAFT for a lawyer
 * (docs/study/ai-marking-consent-and-policy-draft.md): AI marking stays switched off (NEXT_PUBLIC_PLUMI_AI_MARKING) until it is approved.
 * Raise CONSENT_VERSION, and the server's MARK_MIN_CONSENT_VERSION with it, whenever the wording changes materially.
 */
export const SURFACE = "web_marking";
export const CONSENT_VERSION = 1;
export type AgeBand = "18_plus" | "under_18";

export interface Rpc { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }> }

export const CONSENT_COPY = {
  title: "Let Plumi mark your answer?",
  line: "Your answer is sent to DeepSeek, our AI provider, to be marked against the real mark scheme.",
  points: [
    "DeepSeek’s computers may be outside the UK and the EU, including in China.",
    "We don’t send your name or email, and we don’t keep your answer.",
    "Never sold. Never used for adverts.",
  ],
  ageLabel: "I am",
  adult: "18 or over",
  minor: "Under 18",
  parentAsk: "Please show this to a parent or carer first.",
  parentTick: "I have shown a parent or carer.",
  yes: "Yes, mark my answers",
  no: "Not now",
  foot: "You can change your mind any time in Account.",
} as const;

/** The server's current consent for this account: does it cover this wording? */
export async function hasConsent(sb: Rpc): Promise<boolean> {
  const { data, error } = await sb.rpc("ai_consent_status", { p_surface: SURFACE });
  if (error) return false;
  const row = Array.isArray(data) ? data[0] : data;
  return !!row && typeof row === "object" && (row as { granted?: unknown }).granted === true
    && typeof (row as { version?: unknown }).version === "number" && (row as { version: number }).version >= CONSENT_VERSION;
}

/** Record consent. Under 18 cannot be recorded without the parent note ticked (the database refuses it too). */
export async function giveConsent(sb: Rpc, age: AgeBand, parentNoteShown: boolean): Promise<boolean> {
  if (age === "under_18" && !parentNoteShown) return false;
  const { error } = await sb.rpc("ai_consent_give", { p_surface: SURFACE, p_version: CONSENT_VERSION, p_age_band: age, p_parent_note_shown: parentNoteShown });
  return !error;
}

export async function withdrawConsent(sb: Rpc): Promise<boolean> {
  const { error } = await sb.rpc("ai_consent_withdraw", { p_surface: SURFACE });
  return !error;
}
