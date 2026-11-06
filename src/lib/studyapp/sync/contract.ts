import contract from "./CONTRACT.json";

/**
 * The wire contract for backing up flashcards and desk tasks, as typed constants. Every number, name and prefix here is read
 * from CONTRACT.json, which is a byte-identical copy of the iPad repo's tools/sync-contract/CONTRACT.json (the SQL and the iPad
 * read the same file). `npm run sync:contract` holds the copy to the original when SYNC_CONTRACT_SOURCE points at it. To change
 * a name or a limit, change it there first.
 */

export const CONTRACT = contract;

export const SYNC_RPC = {
  push: { name: contract.rpc.push.name, args: contract.rpc.push.args },
  pull: { name: contract.rpc.pull.name, args: contract.rpc.pull.args },
} as const;

export const SYNC_LIMITS = {
  idMin: contract.limits.id.min,
  idMax: contract.limits.id.max,
  idPattern: new RegExp(contract.limits.id.pattern),
  deviceMin: contract.limits.device_id.min,
  deviceMax: contract.limits.device_id.max,
  devicePattern: new RegExp(contract.limits.device_id.pattern),
  changesPerKindPerPush: contract.limits.changes_per_kind_per_push,
  pullLimitDefault: contract.limits.pull_limit.default,
  pullLimitMax: contract.limits.pull_limit.max,
  futureClockClampMs: contract.limits.future_clock_clamp_ms,
  tombstoneKeepDays: contract.limits.tombstone_keep_days,
  liveRows: contract.limits.live_rows_per_account,
  deckTitle: contract.limits.fields.deck_title,
  deckSubject: contract.limits.fields.deck_subject,
  cardSide: contract.limits.fields.card_side,
  pictureName: contract.limits.fields.picture_name,
  taskText: contract.limits.fields.task_text,
  taskSubject: contract.limits.fields.task_subject,
  scheduleJsonBytes: contract.limits.fields.schedule_json_bytes,
} as const;

/** The keys of `p_changes` and of a pull answer, by kind. */
export const KIND_KEYS = {
  deck: contract.kinds.deck.changes_key,
  card: contract.kinds.card.changes_key,
  task: contract.kinds.task.changes_key,
  task_done: contract.kinds.task_done.changes_key,
  flag: contract.kinds.flag.changes_key,
} as const;

export const SCHEDULE = {
  coreFields: contract.schedule.core_fields,
  webExtraFields: contract.schedule.web_extra_fields,
  iosExtraFields: contract.schedule.ios_extra_fields,
  easeMin: contract.schedule.ease_range[0],
  easeMax: contract.schedule.ease_range[1],
} as const;

export const GENERATED_TITLE_PREFIXES: readonly string[] = contract.generated_decks.title_prefixes;

/** The words after `sync:` in the exception message. */
export const SYNC_ERROR_CODES: readonly string[] = contract.errors.codes;

/** Why the server may refuse a row (push answer `refused[].reason`). */
export const REFUSAL_REASONS = ["quota", "too_long", "bad_row", "no_row", "bad_id"] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

/** Pages of this size when pulling (the contract's default is 500 and the maximum 1,000; the brief asks for 200). */
export const PULL_PAGE = 200;

/** The kill switch, as sharing has: NEXT_PUBLIC_PLUMI_SYNC=off hides the choice and runs nothing. */
export const syncSwitchedOff = (): boolean => process.env.NEXT_PUBLIC_PLUMI_SYNC === "off";
