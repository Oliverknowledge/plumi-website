import type { Api } from "@/lib/social/api";
import { isMissingFunction, type ApiError } from "@/lib/social/failure";
import { isShareCode, normaliseCode } from "./code";
import { SHARE_LIMITS, SHARE_RPC, type ReportReason, type ShareRpcKey, type SharedDeck, type SharedRow } from "./contract";
import { codeIn, type ShareReason } from "./lines";
import type { SharePayload } from "./payload";

/**
 * The five calls, over the same transport the friends and library code uses (`Api`): a PostgREST rpc with the project's public key
 * and, when there is one, the signed-in student's token. Every call returns a value and never throws at a view: a failure is a
 * `ShareReason` the screen turns into one calm line (lines.ts). The database decides everything that matters (who may share, the
 * limits, what is hidden); this layer only asks, and trims first so a student is not refused for something fixable.
 */
export type ShareResult<T> = { ok: true; value: T } | { ok: false; reason: ShareReason };
const ok = <T,>(value: T): ShareResult<T> => ({ ok: true, value });
const no = <T = never,>(reason: ShareReason): ShareResult<T> => ({ ok: false, reason });

/** The part of `Api` sharing needs. The browser binding and the page's plain-fetch binding both satisfy it. */
export type ShareApi = Pick<Api, "configured" | "userId" | "rpc">;

const OFFLINE = /failed to fetch|fetch failed|networkerror|network request failed|load failed|aborterror|signal is aborted|operation was aborted|timed? ?out|econn|enotfound|socket/i;

/** An answer from the transport that went wrong, as a reason. A missing function (migration not applied) is `unavailable`. */
export function reasonFor(error: ApiError): ShareReason {
  if (isMissingFunction(error)) return "unavailable";
  // The plain anon role may not call share_deck at all (42501): the same answer to the student as no session.
  if (error.code === "42501" || /permission denied/i.test(error.message)) return "not_signed_in";
  const raised = codeIn(error.message);
  if (raised) return raised;
  if (OFFLINE.test(error.message)) return "offline";
  if (error.status === 429) return "rate_limited";
  if (error.status === 401 || /jwt|not authenticated|invalid claim/i.test(error.message)) return "not_signed_in";
  if (error.status !== undefined && error.status >= 500) return "busy";
  return "other";
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

/** What PostgREST returns for a function: the value, or an object keyed by the function's name, or JSON text. */
function unwrap(data: unknown, fn: string): unknown {
  let v = data;
  if (v && typeof v === "object" && !Array.isArray(v) && fn in (v as object) && Object.keys(v as object).length === 1) v = (v as Record<string, unknown>)[fn];
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("{") || t.startsWith("[")) { try { return JSON.parse(t); } catch { return v; } }
  }
  return v;
}

/** `get_shared_deck`'s answer as a deck, or null if it is not one: a JSON null body (a project that hides rather than raises), or a deck with no readable card, is not found. */
export function decodeDeck(data: unknown): SharedDeck | null {
  let v = unwrap(data, SHARE_RPC.get.name);
  if (Array.isArray(v) && v.length === 1) v = unwrap(v[0], SHARE_RPC.get.name);   // a function that returns a table of one row
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const title = str(o.title)?.trim();
  if (!title || !Array.isArray(o.cards)) return null;
  const cards: SharedDeck["cards"] = [];
  for (const c of o.cards) {
    const front = c && typeof c === "object" ? str((c as Record<string, unknown>).front) : null;
    const back = c && typeof c === "object" ? str((c as Record<string, unknown>).back) : null;
    if (front?.trim() && back?.trim()) cards.push({ front, back });
  }
  if (cards.length === 0) return null;
  const hint = str(o.subject_hint)?.trim();
  return { title, subjectHint: hint ? hint : null, cardCount: cards.length, cards };
}

export function decodeRows(data: unknown): SharedRow[] {
  const v = unwrap(data, SHARE_RPC.mine.name);
  if (!Array.isArray(v)) return [];
  const rows: SharedRow[] = [];
  for (const r of v) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const code = str(o.code), title = str(o.title);
    if (!code || !isShareCode(code) || !title) continue;
    rows.push({ code, title, cardCount: num(o.card_count) ?? 0, createdAt: str(o.created_at) ?? "" });
  }
  return rows;
}

export function createSharing(api: ShareApi) {
  async function call(key: ShareRpcKey, args: Record<string, unknown>): Promise<ShareResult<unknown>> {
    if (!api.configured) return no("unavailable");
    try {
      const { data, error } = await api.rpc(SHARE_RPC[key].name, args);
      return error ? no(reasonFor(error)) : ok(data);
    } catch (e) {
      return no(reasonFor({ message: e instanceof Error ? e.message : String(e) }));
    }
  }

  return {
    /** Put a deck's words on the server and get its code. Needs a real (not anonymous) account; the database refuses the rest. */
    async share(payload: Pick<SharePayload, "title" | "cards" | "subjectHint">): Promise<ShareResult<string>> {
      if (payload.cards.length === 0) return no("empty_deck");
      if (payload.cards.length > SHARE_LIMITS.maxCards) return no("too_many_cards");
      if (!api.userId()) return no("not_signed_in");
      const r = await call("share", { p_title: payload.title, p_cards: payload.cards, p_subject_hint: payload.subjectHint });
      if (!r.ok) return r;
      const code = unwrap(r.value, SHARE_RPC.share.name);
      return typeof code === "string" && isShareCode(code) ? ok(code) : no("other");
    },

    /** Stop sharing. `true` when a live deck of the caller's was stopped, `false` when there was nothing to stop (already stopped). */
    async unshare(raw: string): Promise<ShareResult<boolean>> {
      const code = normaliseCode(raw);
      if (!isShareCode(code)) return no("not_found");
      if (!api.userId()) return no("not_signed_in");
      const r = await call("unshare", { p_code: code });
      return r.ok ? ok(unwrap(r.value, SHARE_RPC.unshare.name) === true) : r;
    },

    /** The caller's live decks, newest first. */
    async mine(): Promise<ShareResult<SharedRow[]>> {
      if (!api.userId()) return no("not_signed_in");
      const r = await call("mine", {});
      return r.ok ? ok(decodeRows(r.value)) : r;
    },

    /** A shared deck, no sign-in needed. Unknown, stopped and hidden codes all come back `not_found`. */
    async get(raw: string): Promise<ShareResult<SharedDeck>> {
      const code = normaliseCode(raw);
      if (!isShareCode(code)) return no("not_found");
      const r = await call("get", { p_code: code });
      if (!r.ok) return r;
      const deck = decodeDeck(r.value);
      return deck ? ok(deck) : no("not_found");
    },

    /** Tell us a deck should not be there. No sign-in needed. */
    async report(raw: string, reason: ReportReason): Promise<ShareResult<true>> {
      const code = normaliseCode(raw);
      if (!isShareCode(code)) return no("not_found");
      const r = await call("report", { p_code: code, p_reason: reason });
      return r.ok ? ok(true) : r;
    },
  };
}

export type Sharing = ReturnType<typeof createSharing>;
