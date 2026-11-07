import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAvailable, fetchEnabled, MAX_ANSWER_CHARS, MAX_PICTURE_CHARS, parseMarkReply, requestMark, requestTranscript, type Deps } from "./api";
import { lineFor } from "./copy";

const REPLY = { marks: 1, outOf: 2, anyHeld: false, rulesVersion: 1, packHash: "a".repeat(64), points: [
  { n: 1, status: "awarded", evidence: "activates enzymes", reason: "You said it activates enzymes." },
  { n: 2, status: "not_awarded", evidence: null, reason: "The scheme wanted amino acids." }] };
const IN = { bank: "aqa-a-level-biology", partId: "74021-jun25-08-3", cropVersion: 3, answer: "it activates enzymes" };

type Call = { url: string; init: RequestInit };
function deps(reply: () => Response | Promise<Response>, over: Partial<Deps> = {}): { d: Deps; calls: Call[] } {
  const calls: Call[] = [];
  const d: Deps = { base: "https://p.supabase.co/functions/v1/mark", apikey: "pub", token: async () => "tok", timeoutMs: 200,
    fetch: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return await reply(); }) as typeof fetch, ...over };
  return { d, calls };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

test("a good reply is a mark, with what was charged and what is left", async () => {
  const { d, calls } = deps(() => json(200, { ok: true, result: REPLY, charged: 1, allowance: { used: 1, limit: 5, window: "week" } }));
  const o = await requestMark(d, IN);
  assert.equal(o.kind, "marked");
  if (o.kind === "marked") { assert.equal(o.reply.marks, 1); assert.deepEqual(o.allowance, { used: 1, limit: 5, window: "week" }); assert.equal(o.charged, 1); }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://p.supabase.co/functions/v1/mark");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), IN);
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, "Bearer tok");
});
test("nobody signed in: no request at all", async () => {
  const { d, calls } = deps(() => json(200, {}), { token: async () => null });
  assert.deepEqual(await requestMark(d, IN), { kind: "signin" });
  assert.equal(calls.length, 0);
});
test("an answer over the limit is not sent", async () => {
  const { d, calls } = deps(() => json(200, {}));
  assert.deepEqual(await requestMark(d, { ...IN, answer: "x".repeat(MAX_ANSWER_CHARS + 1) }), { kind: "too_long" });
  assert.equal(calls.length, 0);
  assert.equal((await requestMark(deps(() => json(200, { ok: true, result: REPLY })).d, { ...IN, answer: "x".repeat(MAX_ANSWER_CHARS) })).kind, "marked");
});
test("every server answer becomes one outcome", async () => {
  const cases: [number, unknown, string][] = [
    [401, { ok: false, code: "unauthorized" }, "signin"], [403, { ok: false, code: "account_required" }, "signin"],
    [403, { ok: false, code: "consent_required", minVersion: 2 }, "consent"], [404, { ok: false, code: "cannot_mark" }, "cannot"],
    [413, { ok: false, code: "answer_too_long" }, "too_long"], [429, { ok: false, code: "allowance", pro: false, window: "week", retryAfter: 7200 }, "allowance"],
    [429, { ok: false, code: "rate" }, "rate"], [429, { ok: false, code: "busy" }, "rate"],
    [503, { ok: false, code: "unavailable" }, "unavailable"], [503, { ok: false, code: "not_configured" }, "unavailable"],
    [502, { ok: false, code: "marking_unavailable" }, "failed"], [500, { ok: false, code: "error" }, "failed"], [400, { ok: false, code: "invalid_body" }, "failed"],
    [200, { ok: true }, "failed"], [200, "nonsense", "failed"],
  ];
  for (const [status, body, kind] of cases) assert.equal((await requestMark(deps(() => json(status, body)).d, IN)).kind, kind, `${status} ${JSON.stringify(body)}`);
});
test("the consent outcome carries the version the server wants; the allowance outcome carries the window and the wait", async () => {
  assert.deepEqual(await requestMark(deps(() => json(403, { ok: false, code: "consent_required", minVersion: 2 })).d, IN), { kind: "consent", minVersion: 2 });
  assert.deepEqual(await requestMark(deps(() => json(429, { ok: false, code: "allowance", pro: true, window: "day", retryAfter: 600 })).d, IN), { kind: "allowance", pro: true, window: "day", retryAfter: 600 });
});
test("a network failure, a timeout and an unreadable body are all just 'failed'", async () => {
  assert.equal((await requestMark(deps(() => { throw new Error("offline"); }).d, IN)).kind, "failed");
  assert.equal((await requestMark(deps(() => new Promise<Response>(() => {}), { fetch: ((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch }).d, IN)).kind, "failed");
  assert.equal((await requestMark(deps(() => new Response("<html>", { status: 502 })).d, IN)).kind, "failed");
});
test("a reply that is not exactly the expected shape is never shown as a mark", () => {
  assert.ok(parseMarkReply(REPLY));
  const bad: unknown[] = [null, [], {}, { ...REPLY, marks: 3 }, { ...REPLY, marks: -1 }, { ...REPLY, outOf: 0 }, { ...REPLY, marks: 1.5 }, { ...REPLY, anyHeld: "no" }, { ...REPLY, points: [] },
    { ...REPLY, points: [{ n: 1, status: "maybe", evidence: null, reason: "" }] }, { ...REPLY, points: [{ n: 1, status: "not_awarded", evidence: "leak", reason: "" }] },
    { ...REPLY, points: [{ n: 1, status: "awarded", evidence: 5, reason: "" }] }, { ...REPLY, points: [{ n: 1, status: "awarded", evidence: null, reason: 5 }] }, { ...REPLY, packHash: 5 }];
  for (const b of bad) assert.equal(parseMarkReply(b), null, JSON.stringify(b).slice(0, 80));
});
test("available: the ids that have a pack, in chunks of 300, and null when it could not be asked", async () => {
  const ids = Array.from({ length: 650 }, (_, i) => `p-${i}-1`);
  const { d, calls } = deps(() => json(200, { ok: true, available: ["p-1-1"] }));
  const got = await fetchAvailable(d, "aqa-a-level-biology", 3, ids);
  assert.deepEqual([...got!], ["p-1-1"]);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((c) => JSON.parse(String(c.init.body)).partIds.length), [300, 300, 50]);
  assert.ok(calls.every((c) => c.url.endsWith("/available")));
  assert.equal(await fetchAvailable(deps(() => json(403, { ok: false, code: "account_required" })).d, "b-b-b", 0, ["a-1-1"]), null);
  assert.equal(await fetchAvailable(deps(() => { throw new Error("x"); }).d, "b-b-b", 0, ["a-1-1"]), null);
  assert.equal(await fetchAvailable(deps(() => json(200, { ok: true })).d, "b-b-b", 0, ["a-1-1"]), null);
});

test("enabled: what the server says for this account, and null when it could not be asked", async () => {
  const on = deps(() => json(200, { ok: true, enabled: true, pro: false })); assert.equal(await fetchEnabled(on.d), true);
  assert.ok(on.calls[0].url.endsWith("/status") && on.calls[0].init.method === "GET");
  assert.equal(await fetchEnabled(deps(() => json(200, { ok: true, enabled: false })).d), false);
  assert.equal(await fetchEnabled(deps(() => json(200, { ok: true })).d), null);
  assert.equal(await fetchEnabled(deps(() => json(200, { ok: true, enabled: "yes" })).d), null);
  assert.equal(await fetchEnabled(deps(() => json(403, { ok: false, code: "account_required" })).d), null);
  assert.equal(await fetchEnabled(deps(() => { throw new Error("x"); }).d), null);
  assert.equal(await fetchEnabled(deps(() => json(200, { ok: true, enabled: true }), { token: async () => null }).d), null);
});

// ---- what the student reads
test("every non-mark outcome has one calm line, with no code, no em dash and no pipeline word", () => {
  const outcomes = [{ kind: "signin" }, { kind: "consent", minVersion: 1 }, { kind: "allowance", pro: false, window: "week", retryAfter: 90000 }, { kind: "allowance", pro: true, window: "day", retryAfter: 600 },
    { kind: "rate" }, { kind: "unavailable" }, { kind: "cannot" }, { kind: "too_long" }, { kind: "failed" }] as const;
  for (const o of outcomes) {
    const line = lineFor(o, Date.UTC(2026, 10, 7, 12));
    assert.ok(line.length > 8 && line.length < 90, line);
    assert.ok(!/—|code|gate|rubric|pack|model|deepseek|server|error|pro\b|price/i.test(line), line);
  }
});
test("the week's wait names the day marks return", () => {
  const sat = Date.UTC(2026, 10, 7, 12);   // Saturday 7 November 2026
  assert.match(lineFor({ kind: "allowance", pro: false, window: "week", retryAfter: 3 * 86400 }, sat), /Tuesday/);
  assert.match(lineFor({ kind: "allowance", pro: true, window: "day", retryAfter: 600 }, sat), /midnight/);
  assert.equal(lineFor({ kind: "cannot" }), "Plumi can’t mark this one.");
});

// ---- reading handwriting: a picture goes to /transcribe, words come back for the student to check, nothing is marked ----

const PIC = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD=";

test("transcript: the picture goes to /transcribe and the words come back trimmed", async () => {
  const { d, calls } = deps(() => json(200, { ok: true, text: "  Glucagon activates enzymes. \n", unreadable: false }));
  assert.deepEqual(await requestTranscript(d, PIC), { kind: "read", text: "Glucagon activates enzymes." });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://p.supabase.co/functions/v1/mark/transcribe");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { image: PIC });
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, "Bearer tok");
});
test("transcript: nobody signed in sends nothing; a picture over the limit is not sent", async () => {
  const none = deps(() => json(200, {}), { token: async () => null });
  assert.deepEqual(await requestTranscript(none.d, PIC), { kind: "signin" });
  assert.equal(none.calls.length, 0);
  const big = deps(() => json(200, {}));
  assert.deepEqual(await requestTranscript(big.d, "x".repeat(MAX_PICTURE_CHARS + 1)), { kind: "failed" });
  assert.equal(big.calls.length, 0);
});
test("transcript: unreadable or empty is 'unreadable', never an empty answer to mark", async () => {
  assert.deepEqual(await requestTranscript(deps(() => json(200, { ok: true, text: "", unreadable: true })).d, PIC), { kind: "unreadable" });
  assert.deepEqual(await requestTranscript(deps(() => json(200, { ok: true, text: "   ", unreadable: false })).d, PIC), { kind: "unreadable" });
});
test("transcript: every server answer becomes one calm outcome", async () => {
  const cases: [number, unknown, string][] = [
    [401, { ok: false, code: "unauthorized" }, "signin"], [403, { ok: false, code: "account_required" }, "signin"], [403, { ok: false, code: "consent_required", minVersion: 2 }, "consent"],
    [429, { ok: false, code: "busy" }, "rate"], [503, { ok: false, code: "unavailable" }, "unavailable"], [413, { ok: false, code: "answer_too_long" }, "too_long"],
    [502, { ok: false, code: "reading_unavailable" }, "failed"], [500, { ok: false, code: "error" }, "failed"], [200, { ok: true }, "failed"], [200, { ok: true, text: 5 }, "failed"],
  ];
  for (const [status, body, kind] of cases) assert.equal((await requestTranscript(deps(() => json(status, body)).d, PIC)).kind, kind, `${status} ${JSON.stringify(body)}`);
  assert.equal((await requestTranscript(deps(() => json(200, { ok: true, text: "x".repeat(MAX_ANSWER_CHARS + 1), unreadable: false })).d, PIC)).kind, "too_long");
  assert.equal((await requestTranscript(deps(() => { throw new Error("offline"); }).d, PIC)).kind, "failed");
});
test("transcript: the unreadable line is calm, has no dash, and names no machinery", () => {
  const line = lineFor({ kind: "unreadable" });
  assert.equal(line, "Plumi couldn’t read that. Try writing it a bit bigger, or type it.");
  assert.ok(!/[—–]/.test(line));
});
