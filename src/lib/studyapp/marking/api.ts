/**
 * The browser's side of web AI marking: three calls to the `mark` function and what they mean for a student. Nothing here decides
 * a mark. The server does (Supabase/functions/mark in the app repo): who may ask, the allowance, the scheme, the model, the rules.
 * This file only sends {bank, partId, cropVersion, answer}, checks the reply is the shape it expects, and turns every way a
 * request can go into one calm outcome with words a student can read (copy.ts). No pipeline word ever reaches the screen.
 *
 * Pure: the token, the fetch and the address are passed in, so it is tested without a network.
 */

export type PointStatus = "awarded" | "not_awarded" | "held";
export interface MarkPoint { n: number; status: PointStatus; evidence: string | null; reason: string }
export interface MarkReply { marks: number; outOf: number; anyHeld: boolean; rulesVersion: number; packHash: string | null; points: MarkPoint[] }
export interface Allowance { used: number; limit: number; window: "day" | "week" }

export type Outcome =
  | { kind: "marked"; reply: MarkReply; charged: number; allowance: Allowance | null }
  | { kind: "signin" }
  | { kind: "consent"; minVersion: number }
  | { kind: "allowance"; pro: boolean; window: "day" | "week"; retryAfter: number }
  | { kind: "rate" }
  | { kind: "unavailable" }
  | { kind: "cannot" }
  | { kind: "too_long" }
  | { kind: "failed" };

export interface Deps {
  /** The function's address: https://<project>.supabase.co/functions/v1/mark */
  base: string;
  apikey: string;
  /** The signed-in student's access token, or null when nobody is signed in. */
  token(): Promise<string | null>;
  fetch: typeof fetch;
  timeoutMs?: number;
}

/** Longest answer the server will mark. It refuses, never truncates, so the screen says so before sending. */
export const MAX_ANSWER_CHARS = 2000;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** The server's reply, or null. Strict on purpose: a reply that is not exactly this shape is a failure, never a mark. */
export function parseMarkReply(raw: unknown): MarkReply | null {
  if (!isObj(raw)) return null;
  const { marks, outOf, anyHeld, rulesVersion, packHash, points } = raw;
  if (!isInt(marks) || !isInt(outOf) || outOf < 1 || outOf > 100 || marks < 0 || marks > outOf) return null;
  if (typeof anyHeld !== "boolean" || !isInt(rulesVersion)) return null;
  if (!(packHash === null || typeof packHash === "string")) return null;
  if (!Array.isArray(points) || points.length === 0 || points.length > 40) return null;
  const out: MarkPoint[] = [];
  for (const p of points) {
    if (!isObj(p) || !isInt(p.n) || typeof p.reason !== "string" || p.reason.length > 600) return null;
    if (p.status !== "awarded" && p.status !== "not_awarded" && p.status !== "held") return null;
    if (!(p.evidence === null || (typeof p.evidence === "string" && p.evidence.length <= MAX_ANSWER_CHARS))) return null;
    if (p.status !== "awarded" && p.evidence !== null) return null;
    out.push({ n: p.n, status: p.status, evidence: p.evidence, reason: p.reason });
  }
  return { marks, outOf, anyHeld, rulesVersion, packHash, points: out };
}

function allowanceOf(v: unknown): Allowance | null {
  if (!isObj(v) || !isInt(v.used) || !isInt(v.limit) || (v.window !== "day" && v.window !== "week")) return null;
  return { used: v.used, limit: v.limit, window: v.window };
}

async function send(deps: Deps, method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; json: Obj } | "signin" | "network"> {
  const token = await deps.token().catch(() => null);
  if (!token) return "signin";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), deps.timeoutMs ?? 35_000);
  try {
    const res = await deps.fetch(`${deps.base}${path}`, {
      method, signal: ctl.signal,
      headers: { authorization: `Bearer ${token}`, apikey: deps.apikey, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json: unknown = {};
    try { json = await res.json(); } catch { /* a reply with no body is read as an empty one */ }
    return { status: res.status, json: isObj(json) ? json : {} };
  } catch {
    return "network";
  } finally {
    clearTimeout(timer);
  }
}

export interface MarkInput { bank: string; partId: string; cropVersion: number; answer: string }

/** Ask for one mark. Never throws: every way it can go is an Outcome. */
export async function requestMark(deps: Deps, input: MarkInput): Promise<Outcome> {
  if (input.answer.length > MAX_ANSWER_CHARS) return { kind: "too_long" };
  const r = await send(deps, "POST", "", input);
  if (r === "signin") return { kind: "signin" };
  if (r === "network") return { kind: "failed" };
  const { status, json } = r;
  const code = typeof json.code === "string" ? json.code : "";
  if (status === 200 && json.ok === true) {
    const reply = parseMarkReply(isObj(json.result) ? json.result : null);
    return reply ? { kind: "marked", reply, charged: isInt(json.charged) ? json.charged : 0, allowance: allowanceOf(json.allowance) } : { kind: "failed" };
  }
  if (status === 401 || code === "account_required" || code === "unauthorized") return { kind: "signin" };
  if (code === "consent_required") return { kind: "consent", minVersion: isInt(json.minVersion) ? json.minVersion : 1 };
  if (code === "cannot_mark") return { kind: "cannot" };
  if (code === "answer_too_long") return { kind: "too_long" };
  if (code === "allowance") {
    return { kind: "allowance", pro: json.pro === true, window: json.window === "day" ? "day" : "week", retryAfter: isInt(json.retryAfter) && json.retryAfter > 0 ? json.retryAfter : 3600 };
  }
  if (code === "rate" || code === "busy") return { kind: "rate" };
  if (code === "unavailable" || code === "not_configured") return { kind: "unavailable" };
  return { kind: "failed" };
}

/** Which of these parts can be marked (a published pack for this version of the pictures). Null when it could not be asked: not remembered as "none". */
export async function fetchAvailable(deps: Deps, bank: string, cropVersion: number, partIds: string[]): Promise<Set<string> | null> {
  const found = new Set<string>();
  for (let i = 0; i < partIds.length; i += 300) {
    const r = await send(deps, "POST", "/available", { bank, cropVersion, partIds: partIds.slice(i, i + 300) });
    if (r === "signin" || r === "network" || r.status !== 200 || r.json.ok !== true || !Array.isArray(r.json.available)) return null;
    for (const id of r.json.available) if (typeof id === "string") found.add(id);
  }
  return found;
}
