/**
 * Sharing a flashcard deck by link: what the website asks of the Supabase project, and the limits the database enforces.
 * The migration is 0130 in the iPad repo (branch feature/shared-decks); `npm run sharing:contract` holds this file to the
 * contract that migration publishes (tools/shared-decks-check/CONTRACT.json). Written as data so a renamed function or
 * parameter fails there before it fails for a student.
 */

export const SHARE_RPC = {
  share: { name: "share_deck", args: ["p_title", "p_cards", "p_subject_hint"] },
  unshare: { name: "unshare_deck", args: ["p_code"] },
  mine: { name: "my_shared_decks", args: [] },
  get: { name: "get_shared_deck", args: ["p_code"] },
  report: { name: "report_shared_deck", args: ["p_code", "p_reason"] },
} as const;

export type ShareRpcKey = keyof typeof SHARE_RPC;

/** The limits the database enforces. The client trims to them first so a student is never refused for something we could have fixed. */
export const SHARE_LIMITS = {
  maxCards: 500,
  minCardChars: 1,
  maxCardChars: 1500,
  maxTitleChars: 80,
  maxSubjectChars: 40,
  liveDecksPerStudent: 20,
  sharesPerDay: 10,
  /** The database refuses a cards payload over this many bytes (too_many_cards). */
  maxJsonBytes: 2_000_000,
} as const;

/**
 * What a share code looks like: the server mints 16 characters of 0123456789abcdefghjkmnpqrstvwxyz and accepts 12 to 64 of
 * [0-9a-z], ignoring case and surrounding spaces on lookup. This is checked on the code as `normaliseCode` leaves it.
 */
export const CODE_PATTERN = /^[0-9a-z]{12,64}$/;

/** Every word the database raises, as the exception message `social:<code>` (SQLSTATE P0001, HTTP 400). */
export const ERROR_CODES = [
  "not_signed_in", "empty_deck", "too_many_cards", "card_too_long", "title_too_long",
  "too_many_decks", "too_many_today", "not_found", "rate_limited", "bad_request",
] as const;
export type ShareErrorCode = (typeof ERROR_CODES)[number];

/** The reasons offered when reporting a deck, as sent to `report_shared_deck`. */
export const REPORT_REASONS = [
  { id: "not_school_work", label: "Not school work" },
  { id: "rude", label: "Rude or unkind" },
  { id: "other", label: "Other" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

/** The shape `get_shared_deck` answers with. */
export interface SharedDeck { title: string; subjectHint: string | null; cardCount: number; cards: { front: string; back: string }[] }
/** One row of `my_shared_decks`. */
export interface SharedRow { code: string; title: string; cardCount: number; createdAt: string }

/**
 * The kill switch: set NEXT_PUBLIC_SHARED_DECKS=off in the environment (and redeploy) and the app draws no Share, no Shared tag
 * and no list, and every /d/<code> link shows "This deck is not shared any more." without asking the database. Decks already shared
 * stay in the database untouched; turning the switch off again brings the links back.
 */
export const sharingSwitchedOff = (): boolean => process.env.NEXT_PUBLIC_SHARED_DECKS === "off";
