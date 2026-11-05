/**
 * npm run sharing:test   (node:test, run through tsx; no network, no database, no browser)
 *
 * What it holds: share codes and links; which decks may be shared; what is sent for one (text only, trimmed, capped); every error
 * the database raises turned into one calm line; the service asking for exactly the functions and parameters the contract names,
 * against a fake Api, for every call and every error; "Add to my decks" making an independent copy; and the probe that keeps Share
 * hidden until the migration is applied. The database itself is tested where it lives (tools/shared-decks-check in the iPad repo);
 * `npm run sharing:contract` holds this code to that contract.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Api } from "@/lib/social/api";
import type { ApiError } from "@/lib/social/failure";
import { addCard, addDeck, addStarters, EMPTY, sanitise, type AppData } from "../model";
import {
  ADDED_KEY, addSharedDeck, addedDeckFor, canRetry, canShare, CODE_PATTERN, codeForDeck, codeIn, ERROR_CODES, isShareCode, makeProbe, normaliseCode, parseShareCode,
  probeSharing, PROBE_CODE, reasonFor, reasonLine, readCodes, REPORT_REASONS, restApi, restConfig, createSharing, SHARE_LIMITS, SHARE_RPC, shareLink, sharePayload,
  writeCodes, type ShareReason,
} from "./index";

const T = Date.UTC(2026, 10, 5, 10, 0, 0);
const CODE = "ab3def6hjk9mnp2q";

/** A deck of the student's own with cards in it. */
function deckWith(cards: [string, string][], title = "Chemistry · Rates", subject: string | null = "Chemistry"): { data: AppData; deckId: string } {
  const made = addDeck(EMPTY, title, T, subject);
  let data = made.data;
  cards.forEach(([f, b], i) => { data = addCard(data, made.deck!.id, f, b, T + i); });
  return { data, deckId: made.deck!.id };
}

/** A fake transport: every rpc is recorded, and answered by `reply`. */
function fakeApi(reply: (name: string, args: Record<string, unknown>) => { data?: unknown; error?: ApiError }, opts: { configured?: boolean; user?: string | null } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const api: Pick<Api, "configured" | "userId" | "rpc"> = {
    configured: opts.configured ?? true,
    userId: () => (opts.user === undefined ? "user-1" : opts.user),
    async rpc(name, args) {
      calls.push({ name, args: args ?? {} });
      const r = reply(name, args ?? {});
      return { data: r.data ?? null, error: r.error ?? null };
    },
  };
  return { api, calls };
}

describe("codes and links", () => {
  it("accepts what the server mints and nothing that could break a URL", () => {
    for (const ok of [CODE, "a".repeat(12), "0123456789abcdef", "x".repeat(64)]) assert.ok(isShareCode(ok), ok);
    for (const bad of ["", "short", "a".repeat(11), "a".repeat(65), "has space 1234567", "slash/slash/slash", "dot.dot.dot.dot", "é".repeat(16), "../../etc/passwd", "a=b&c=d?e=f", "A-b_C".repeat(4), "UPPERCASEUPPERCASE", null, 5, undefined]) assert.ok(!isShareCode(bad), String(bad));
    assert.equal(CODE_PATTERN.source, "^[0-9a-z]{12,64}$");
  });
  it("ignores case and surrounding spaces, as the server does on lookup", () => {
    assert.equal(normaliseCode(`  ${CODE.toUpperCase()}\n`), CODE);
    assert.equal(parseShareCode(CODE.toUpperCase()), CODE);
    assert.equal(shareLink(CODE.toUpperCase()), `https://study.tryplumi.app/d/${CODE}`);
  });
  it("writes the link on the app's host in production, and on the page's own address while developing", () => {
    assert.equal(shareLink(CODE), `https://study.tryplumi.app/d/${CODE}`);
    assert.equal(shareLink(CODE, "https://study.tryplumi.app"), `https://study.tryplumi.app/d/${CODE}`);
    assert.equal(shareLink(CODE, "https://tryplumi.app"), `https://study.tryplumi.app/d/${CODE}`, "a link made from the marketing site is still written on the app's host");
    assert.equal(shareLink(CODE, "https://www.tryplumi.app"), `https://study.tryplumi.app/d/${CODE}`);
    assert.equal(shareLink(CODE, "http://localhost:3800"), `http://localhost:3800/d/${CODE}`);
    assert.equal(shareLink(CODE, "http://localhost:3800/"), `http://localhost:3800/d/${CODE}`);
    assert.equal(shareLink(CODE, "not a url"), "not a url/d/" + CODE, "an address that is not a URL is used as given rather than guessed at");
    assert.equal(shareLink(CODE, null), `https://study.tryplumi.app/d/${CODE}`);
  });
  it("reads a code back from a pasted link or the code alone", () => {
    assert.equal(parseShareCode(CODE), CODE);
    assert.equal(parseShareCode(`  ${CODE}\n`), CODE);
    assert.equal(parseShareCode(`https://study.tryplumi.app/d/${CODE}`), CODE);
    assert.equal(parseShareCode(`https://study.tryplumi.app/d/${CODE}/?x=1#y`), CODE);
    assert.equal(parseShareCode(`https://study.tryplumi.app/d/${CODE.toUpperCase()}`), CODE);
    assert.equal(parseShareCode("https://study.tryplumi.app/d/short"), null);
    assert.equal(parseShareCode("https://example.com/other"), null);
    assert.equal(parseShareCode(""), null);
  });
});

describe("which decks may be shared", () => {
  it("allows a deck the student made or imported", () => {
    assert.ok(canShare({ title: "Mine", starter: null }));
    assert.ok(canShare(deckWith([["a", "b"]]).data.decks[0]));
  });
  it("refuses Plumi's ready-made decks, even renamed", () => {
    const starters = addStarters(EMPTY, ["chem-carbonyls", "phys-mechanics"], T);
    assert.ok(starters.decks.length >= 1);
    for (const d of starters.decks) assert.equal(canShare(d), false, d.title);
    assert.equal(canShare({ ...starters.decks[0], title: "My own name now" }), false);
  });
  it("refuses nothing-to-share: no deck, no title", () => {
    assert.equal(canShare(null), false);
    assert.equal(canShare(undefined), false);
    assert.equal(canShare({ title: "   ", starter: null }), false);
  });
  it("is decided from the deck's fields: a new kind of deck must be decided on purpose", () => {
    // If this list changes, a new kind of deck exists (for example one made from exam-board mark schemes, past papers or the
    // student's mistakes). Decide in `canShare` whether it may leave the device, then update this list.
    assert.deepEqual(Object.keys(deckWith([["a", "b"]]).data.decks[0]).sort(), ["createdAt", "id", "starter", "subject", "title"]);
  });
});

describe("what is sent for a deck", () => {
  it("is the title, the subject as a label, and the cards' words in the order they were made", () => {
    const { data, deckId } = deckWith([["Q1", "A1"], ["Q2", "A2"], ["Q3", "A3"]]);
    const p = sharePayload(data, deckId)!;
    assert.equal(p.title, "Chemistry · Rates");
    assert.equal(p.subjectHint, "Chemistry");
    assert.deepEqual(p.cards, [{ front: "Q1", back: "A1" }, { front: "Q2", back: "A2" }, { front: "Q3", back: "A3" }]);
    assert.equal(p.count, 3);
    // nothing of the schedule or the ids travels
    assert.deepEqual(Object.keys(p.cards[0]).sort(), ["back", "front"]);
    assert.ok(!JSON.stringify(p).includes(deckId));
  });
  it("sorts by when the cards were made, not by where they sit in storage", () => {
    const { data, deckId } = deckWith([["first", "1"], ["second", "2"]]);
    const shuffled = { ...data, cards: [...data.cards].reverse() };
    assert.deepEqual(sharePayload(shuffled, deckId)!.cards.map((c) => c.front), ["first", "second"]);
  });
  it("is text only: anything that is not a string is not sent, and stray pictures and sounds are not text", () => {
    const { data, deckId } = deckWith([["ok", "fine"], ["x", "y"]]);
    const odd = { ...data, cards: data.cards.map((c, i) => (i === 1 ? ({ ...c, front: { image: "data:image/png;base64,AAAA" }, back: "text" } as unknown as typeof c) : c)) };
    const p = sharePayload(odd, deckId)!;
    assert.deepEqual(p.cards, [{ front: "ok", back: "fine" }]);
    assert.equal(p.dropped, 1);
    assert.ok(!JSON.stringify(p).includes("base64"));
  });
  it("trims, keeps line breaks, and drops invisible direction and zero-width characters", () => {
    const { data, deckId } = deckWith([["  What is\r\nrate?  ", "​speed‮ of reaction‏\n"]]);
    const p = sharePayload(data, deckId)!;
    assert.deepEqual(p.cards, [{ front: "What is\nrate?", back: "speed of reaction" }]);
  });
  it("drops a card whose front or back is empty, and says how many", () => {
    const { data, deckId } = deckWith([["keep", "me"]]);
    const more: AppData = { ...data, cards: [...data.cards, { ...data.cards[0], id: "c2", front: "   ", createdAt: T + 5 }, { ...data.cards[0], id: "c3", back: "", createdAt: T + 6 }] };
    const p = sharePayload(more, deckId)!;
    assert.equal(p.count, 1);
    assert.equal(p.dropped, 2);
  });
  it("cuts a side to the database's limit by characters, never splitting an emoji", () => {
    const { data, deckId } = deckWith([["a", "b"]]);
    const long = { ...data, cards: data.cards.map((c) => ({ ...c, front: "x".repeat(2000), back: "\u{1F600}".repeat(1600) })) };
    const p = sharePayload(long, deckId)!;
    assert.equal(Array.from(p.cards[0].front).length, SHARE_LIMITS.maxCardChars);
    assert.equal(Array.from(p.cards[0].back).length, SHARE_LIMITS.maxCardChars);
    assert.ok(!/\uD83D$/.test(p.cards[0].back), "no half of a pair at the cut");
  });
  it("keeps the first 500 cards of a bigger deck and says how many were left out", () => {
    const { data, deckId } = deckWith([["a", "b"]]);
    const base = data.cards[0];
    const many = { ...data, cards: Array.from({ length: 520 }, (_, i) => ({ ...base, id: `c${i}`, front: `q${i}`, back: `a${i}`, createdAt: T + i })) };
    const p = sharePayload(many, deckId)!;
    assert.equal(p.count, SHARE_LIMITS.maxCards);
    assert.equal(p.overLimit, 20);
    assert.equal(p.cards[0].front, "q0");
    assert.equal(p.cards[499].front, "q499");
  });
  it("keeps a payload under the database's 2,000,000 byte guard, dropping the last cards (emoji are 4 bytes each)", () => {
    const { data, deckId } = deckWith([["a", "b"]]);
    const base = data.cards[0];
    const heavy = { ...data, cards: Array.from({ length: 400 }, (_, i) => ({ ...base, id: `c${i}`, front: "\u{1F600}".repeat(700), back: "\u{1F600}".repeat(700), createdAt: T + i })) };
    const p = sharePayload(heavy, deckId)!;
    assert.ok(p.count < 400 && p.count > 100, String(p.count));
    assert.ok(new TextEncoder().encode(JSON.stringify(p.cards)).length < SHARE_LIMITS.maxJsonBytes);
    assert.equal(p.overLimit, 400 - p.count);
    assert.equal(p.cards[0].front, "\u{1F600}".repeat(700), "the first cards are the ones kept");
  });
  it("cuts a long title, tidies its spaces, and leaves out an empty subject", () => {
    const { data, deckId } = deckWith([["a", "b"]], "  Spaced   out  ", null);
    const p = sharePayload({ ...data, decks: data.decks.map((d) => ({ ...d, title: `  ${"t".repeat(100)}  ` })) }, deckId)!;
    assert.equal(p.title.length, SHARE_LIMITS.maxTitleChars);
    assert.equal(sharePayload(data, deckId)!.title, "Spaced out");
    assert.equal(sharePayload(data, deckId)!.subjectHint, null);
    const subj = sharePayload({ ...data, decks: data.decks.map((d) => ({ ...d, subject: "s".repeat(60) })) }, deckId)!;
    assert.equal(subj.subjectHint!.length, SHARE_LIMITS.maxSubjectChars);
  });
  it("refuses a starter deck and an unknown one", () => {
    const starters = addStarters(EMPTY, ["chem-carbonyls"], T);
    assert.equal(sharePayload(starters, starters.decks[0].id), null);
    assert.equal(sharePayload(starters, "nope"), null);
  });
  it("sends an empty list for an empty deck (the sheet says to add a card; the service refuses it)", () => {
    const { data, deckId } = deckWith([]);
    assert.equal(sharePayload(data, deckId)!.count, 0);
  });
});

describe("the line a student reads", () => {
  const all: ShareReason[] = [...ERROR_CODES, "unavailable", "offline", "busy", "other"];
  it("has one for every error the database raises and every way the connection fails", () => {
    for (const r of all) assert.ok(reasonLine(r).length > 8, r);
  });
  it("is calm: no em dash, no jargon, no codes, never the word error, one short line", () => {
    for (const r of all) {
      const line = reasonLine(r);
      assert.doesNotMatch(line, /—|–/, `${r}: no dashes`);
      assert.doesNotMatch(line, /error|exception|rpc|supabase|postgres|json|status|http|_/i, `${r}: ${line}`);
      assert.ok(line.length <= 90, `${r} is short`);
      assert.doesNotMatch(line, /\n/);
    }
  });
  it("says the limits in plain words", () => {
    assert.equal(reasonLine("too_many_decks"), "You have 20 shared decks. Stop sharing one to share another.");
    assert.match(reasonLine("too_many_today"), /tomorrow/i);
    assert.match(reasonLine("too_many_cards"), /500/);
  });
  it("finds the database's word whatever wraps it", () => {
    for (const c of ERROR_CODES) {
      assert.equal(codeIn(c), c);
      assert.equal(codeIn(`social:${c}`), c);
      assert.equal(codeIn(`shared:${c}`), c);
      assert.equal(codeIn(`ERROR: ${c.toUpperCase()}\nCONTEXT: PL/pgSQL function`), c);
    }
    assert.equal(codeIn("something else"), null);
    assert.equal(codeIn("not_found_anywhere"), null, "a longer word is not the code");
    assert.equal(codeIn("rate_limited and not_found"), "rate_limited", "the first word wins");
  });
  it("offers a retry where trying again can work", () => {
    for (const r of ["offline", "busy", "rate_limited", "other"] as ShareReason[]) assert.ok(canRetry(r), r);
    for (const r of ["too_many_decks", "too_many_today", "not_signed_in", "empty_deck", "not_found", "unavailable"] as ShareReason[]) assert.ok(!canRetry(r), r);
  });
  it("turns what the transport says into a reason", () => {
    assert.equal(reasonFor({ message: "Could not find the function public.get_shared_deck(p_code) in the schema cache", code: "PGRST202", status: 404 }), "unavailable");
    assert.equal(reasonFor({ message: "not_found", code: "P0001", status: 400 }), "not_found");
    assert.equal(reasonFor({ message: "TypeError: Failed to fetch" }), "offline");
    assert.equal(reasonFor({ message: "TimeoutError: The operation was aborted due to timeout" }), "offline");
    assert.equal(reasonFor({ message: "x", status: 429 }), "rate_limited");
    assert.equal(reasonFor({ message: "JWT expired", status: 401 }), "not_signed_in");
    assert.equal(reasonFor({ message: "permission denied for function share_deck", code: "42501", status: 403 }), "not_signed_in", "the plain anon role may not share: sign in");
    assert.equal(reasonFor({ message: "social:not_signed_in", code: "P0001", status: 400 }), "not_signed_in");
    assert.equal(reasonFor({ message: "social:some_new_word", code: "P0001", status: 400 }), "other", "an unknown word is a quiet try-again-later");
    assert.equal(reasonFor({ message: "boom", status: 503 }), "busy");
    assert.equal(reasonFor({ message: "weird", status: 400 }), "other");
  });
});

describe("the service", () => {
  const payload = { title: "Rates", cards: [{ front: "q", back: "a" }], subjectHint: "Chemistry" as string | null };
  const row = { code: CODE, title: "Rates", card_count: 12, created_at: "2026-11-05T10:00:00Z" };

  it("share: sends exactly the contract's function and parameter names, and returns the code", async () => {
    const { api, calls } = fakeApi(() => ({ data: CODE }));
    const r = await createSharing(api).share(payload);
    assert.deepEqual(r, { ok: true, value: CODE });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, SHARE_RPC.share.name);
    assert.deepEqual(Object.keys(calls[0].args).sort(), [...SHARE_RPC.share.args].sort());
    assert.deepEqual(calls[0].args, { p_title: "Rates", p_cards: [{ front: "q", back: "a" }], p_subject_hint: "Chemistry" });
  });
  it("share: a deck with no subject sends null for the hint", async () => {
    const { api, calls } = fakeApi(() => ({ data: CODE }));
    await createSharing(api).share({ ...payload, subjectHint: null });
    assert.equal(calls[0].args.p_subject_hint, null);
  });
  it("share: refuses an empty deck, a deck over the limit and a signed-out student without asking the server", async () => {
    const { api, calls } = fakeApi(() => ({ data: CODE }));
    const s = createSharing(api);
    assert.deepEqual(await s.share({ ...payload, cards: [] }), { ok: false, reason: "empty_deck" });
    assert.deepEqual(await s.share({ ...payload, cards: Array.from({ length: 501 }, () => ({ front: "q", back: "a" })) }), { ok: false, reason: "too_many_cards" });
    const out = fakeApi(() => ({ data: CODE }), { user: null });
    assert.deepEqual(await createSharing(out.api).share(payload), { ok: false, reason: "not_signed_in" });
    assert.equal(calls.length + out.calls.length, 0);
  });
  it("share: an answer that is not a code is a quiet failure, not a broken link", async () => {
    for (const data of [null, 5, "../etc", { nope: 1 }, ""]) {
      const { api } = fakeApi(() => ({ data }));
      assert.deepEqual(await createSharing(api).share(payload), { ok: false, reason: "other" }, JSON.stringify(data));
    }
  });
  it("share: reads the code however PostgREST wraps it", async () => {
    for (const data of [CODE, { share_deck: CODE }, JSON.stringify(CODE).slice(1, -1)]) {
      const { api } = fakeApi(() => ({ data }));
      assert.deepEqual(await createSharing(api).share(payload), { ok: true, value: CODE });
    }
  });
  it("unshare: sends the code, and says whether a live deck was stopped", async () => {
    const yes = fakeApi(() => ({ data: true }));
    assert.deepEqual(await createSharing(yes.api).unshare(CODE), { ok: true, value: true });
    assert.equal(yes.calls[0].name, SHARE_RPC.unshare.name);
    assert.deepEqual(yes.calls[0].args, { p_code: CODE });
    const no = fakeApi(() => ({ data: false }));
    assert.deepEqual(await createSharing(no.api).unshare(CODE), { ok: true, value: false });
    assert.deepEqual(await createSharing(fakeApi(() => ({}), { user: null }).api).unshare(CODE), { ok: false, reason: "not_signed_in" });
    assert.deepEqual(await createSharing(yes.api).unshare("bad"), { ok: false, reason: "not_found" });
    assert.equal(yes.calls.length, 1, "a malformed code is never sent");
  });
  it("mine: reads the rows, newest first as given, and drops rows it cannot use", async () => {
    const { api, calls } = fakeApi(() => ({ data: [row, { ...row, code: "short" }, { nope: true }, { ...row, code: "zz3def6hjk9mnp2q", title: "Second", card_count: "7" }] }));
    const r = await createSharing(api).mine();
    assert.equal(calls[0].name, SHARE_RPC.mine.name);
    assert.deepEqual(calls[0].args, {});
    assert.deepEqual(r, { ok: true, value: [
      { code: CODE, title: "Rates", cardCount: 12, createdAt: "2026-11-05T10:00:00Z" },
      { code: "zz3def6hjk9mnp2q", title: "Second", cardCount: 7, createdAt: "2026-11-05T10:00:00Z" },
    ] });
  });
  it("mine: one row is still a list, no rows is an empty list", async () => {
    assert.deepEqual((await createSharing(fakeApi(() => ({ data: [row] })).api).mine()), { ok: true, value: [{ code: CODE, title: "Rates", cardCount: 12, createdAt: "2026-11-05T10:00:00Z" }] });
    assert.deepEqual(await createSharing(fakeApi(() => ({ data: [] })).api).mine(), { ok: true, value: [] });
    assert.deepEqual(await createSharing(fakeApi(() => ({ data: null })).api).mine(), { ok: true, value: [] });
    assert.deepEqual(await createSharing(fakeApi(() => ({}), { user: null }).api).mine(), { ok: false, reason: "not_signed_in" });
  });
  it("get: needs no sign-in, sends the code, and reads the deck", async () => {
    const body = { title: "Rates", subject_hint: "Chemistry", card_count: 2, cards: [{ front: "q1", back: "a1" }, { front: "q2", back: "a2" }] };
    const { api, calls } = fakeApi(() => ({ data: body }), { user: null });
    const r = await createSharing(api).get(CODE);
    assert.equal(calls[0].name, SHARE_RPC.get.name);
    assert.deepEqual(calls[0].args, { p_code: CODE });
    assert.deepEqual(r, { ok: true, value: { title: "Rates", subjectHint: "Chemistry", cardCount: 2, cards: body.cards } });
  });
  it("get: reads the deck however PostgREST wraps it, and keeps only readable cards", async () => {
    const body = { title: "T", subject_hint: null, card_count: 3, cards: [{ front: "q", back: "a" }, { front: "", back: "x" }, { front: 3, back: "x" }, null] };
    for (const data of [body, [body], { get_shared_deck: body }, JSON.stringify(body)]) {
      const r = await createSharing(fakeApi(() => ({ data })).api).get(CODE);
      assert.deepEqual(r, { ok: true, value: { title: "T", subjectHint: null, cardCount: 1, cards: [{ front: "q", back: "a" }] } });
    }
  });
  it("get: a malformed code is not sent, and an answer with no usable deck is not found", async () => {
    const { api, calls } = fakeApi(() => ({ data: { title: "T", cards: [] } }));
    assert.deepEqual(await createSharing(api).get("../x"), { ok: false, reason: "not_found" });
    assert.equal(calls.length, 0);
    for (const data of [null, "x", [], { title: "", cards: [{ front: "a", back: "b" }] }, { title: "T" }, { title: "T", cards: [] }]) {
      assert.deepEqual(await createSharing(fakeApi(() => ({ data })).api).get(CODE), { ok: false, reason: "not_found" }, JSON.stringify(data));
    }
  });
  it("report: sends the code and the reason, needs no sign-in", async () => {
    const { api, calls } = fakeApi(() => ({ data: null }), { user: null });
    assert.deepEqual(await createSharing(api).report(CODE, "rude"), { ok: true, value: true });
    assert.equal(calls[0].name, SHARE_RPC.report.name);
    assert.deepEqual(calls[0].args, { p_code: CODE, p_reason: "rude" });
    assert.deepEqual(REPORT_REASONS.map((r) => r.label), ["Not school work", "Rude or unkind", "Other"]);
  });
  it("turns every error the database raises into its reason, for every call", async () => {
    const s = (code: string) => createSharing(fakeApi(() => ({ error: { message: `social:${code}`, code: "P0001", status: 400 } })).api);
    for (const c of ERROR_CODES) {
      assert.deepEqual(await s(c).share(payload), { ok: false, reason: c }, `share ${c}`);
      assert.deepEqual(await s(c).unshare(CODE), { ok: false, reason: c }, `unshare ${c}`);
      assert.deepEqual(await s(c).mine(), { ok: false, reason: c }, `mine ${c}`);
      assert.deepEqual(await s(c).get(CODE), { ok: false, reason: c }, `get ${c}`);
      assert.deepEqual(await s(c).report(CODE, "other"), { ok: false, reason: c }, `report ${c}`);
    }
  });
  it("unknown, stopped and hidden codes fail the same way: not_found, whether raised or answered with a JSON null", async () => {
    const r = await createSharing(fakeApi(() => ({ error: { message: "social:not_found", status: 400 } })).api).get(CODE);
    assert.deepEqual(r, { ok: false, reason: "not_found" });
    assert.deepEqual(await createSharing(fakeApi(() => ({ data: null })).api).get(CODE), { ok: false, reason: "not_found" });
  });
  it("sends a code in its normal form even when it was typed in capitals", async () => {
    const { api, calls } = fakeApi(() => ({ data: true }));
    await createSharing(api).unshare(`  ${CODE.toUpperCase()} `);
    assert.deepEqual(calls[0].args, { p_code: CODE });
  });
  it("is unavailable, not broken, when the project has no such function or no project at all", async () => {
    const missing = fakeApi(() => ({ error: { message: "Could not find the function public.share_deck", code: "PGRST202", status: 404 } }));
    assert.deepEqual(await createSharing(missing.api).share(payload), { ok: false, reason: "unavailable" });
    assert.deepEqual(await createSharing(missing.api).get(CODE), { ok: false, reason: "unavailable" });
    const off = fakeApi(() => ({ data: CODE }), { configured: false });
    assert.deepEqual(await createSharing(off.api).get(CODE), { ok: false, reason: "unavailable" });
    assert.equal(off.calls.length, 0);
  });
  it("never throws at a view: a transport that throws is a reason", async () => {
    const api = { configured: true, userId: () => "u", rpc: async () => { throw new TypeError("Failed to fetch"); } } as Pick<Api, "configured" | "userId" | "rpc">;
    assert.deepEqual(await createSharing(api).get(CODE), { ok: false, reason: "offline" });
    assert.deepEqual(await createSharing(api).share(payload), { ok: false, reason: "offline" });
  });
});

describe("Add to my decks", () => {
  const shared = { title: "Chemistry · Rates", subjectHint: "Chemistry", cardCount: 3, cards: [{ front: "q1", back: "a1" }, { front: "q2", back: "a2" }, { front: "q3", back: "a3" }] };

  it("makes an ordinary private deck with new ids and the original's title", () => {
    const before = deckWith([["mine", "mine"]]).data;
    const r = addSharedDeck(before, shared, T + 1000);
    assert.equal(r.added, 3);
    const deck = r.data.decks.find((d) => d.id === r.deckId)!;
    assert.equal(deck.title, "Chemistry · Rates");
    assert.equal(deck.subject, "Chemistry");
    assert.equal(deck.starter, null, "an ordinary deck: nothing marks it as shared or as ours");
    assert.deepEqual(Object.keys(deck).sort(), ["createdAt", "id", "starter", "subject", "title"]);
    const cards = r.data.cards.filter((c) => c.deckId === deck.id);
    assert.deepEqual(cards.map((c) => [c.front, c.back]), [["q1", "a1"], ["q2", "a2"], ["q3", "a3"]]);
    assert.equal(new Set(r.data.cards.map((c) => c.id)).size, r.data.cards.length, "every id is new and unique");
    assert.ok(cards.every((c) => c.sch.state === "new" && c.lastReviewed === null), "a fresh schedule");
    // what was there is untouched
    assert.deepEqual(r.data.decks[0], before.decks[0]);
    assert.deepEqual(r.data.cards[0], before.cards[0]);
  });
  it("is the friend's own: changing the copy cannot change the shared deck, and the same link adds a second, independent copy", () => {
    const a = addSharedDeck(EMPTY, shared, T);
    const b = addSharedDeck(a.data, shared, T + 5);
    assert.notEqual(a.deckId, b.deckId);
    assert.equal(b.data.decks.length, 2);
    assert.equal(shared.cards[0].front, "q1", "the shared deck object is not mutated");
    const edited = { ...b.data, cards: b.data.cards.map((c) => (c.deckId === a.deckId ? { ...c, front: "changed" } : c)) };
    assert.deepEqual(edited.cards.filter((c) => c.deckId === b.deckId).map((c) => c.front), ["q1", "q2", "q3"]);
  });
  it("survives the store's own check (sanitise keeps all of it)", () => {
    const r = addSharedDeck(EMPTY, shared, T);
    const back = sanitise(JSON.parse(JSON.stringify(r.data)));
    assert.equal(back.decks.length, 1);
    assert.equal(back.cards.length, 3);
  });
  it("keeps a long card whole instead of cutting it to the hand-typed limits", () => {
    const long = { ...shared, cards: [{ front: "f".repeat(1500), back: "b".repeat(1500) }] };
    const r = addSharedDeck(EMPTY, long, T);
    assert.equal(r.data.cards[0].front.length, 1500);
    assert.equal(r.data.cards[0].back.length, 1500);
  });
  it("puts a deck with an unknown subject under no subject", () => {
    assert.equal(addSharedDeck(EMPTY, { ...shared, subjectHint: "Underwater basket weaving" }, T).data.decks[0].subject, null);
    assert.equal(addSharedDeck(EMPTY, { ...shared, subjectHint: null }, T).data.decks[0].subject, null);
    assert.equal(addSharedDeck(EMPTY, { ...shared, subjectHint: "maths" }, T).data.decks[0].subject, "Maths");
    assert.equal(addSharedDeck(EMPTY, { ...shared, subjectHint: "Other" }, T).data.decks[0].subject, null);
  });
  it("adds nothing for a deck with no title or no usable card", () => {
    assert.equal(addSharedDeck(EMPTY, { ...shared, title: "  " }, T).deckId, null);
    assert.equal(addSharedDeck(EMPTY, { ...shared, cards: [{ front: " ", back: "x" }] }, T).deckId, null);
    assert.equal(addSharedDeck(EMPTY, { ...shared, cards: [] }, T).data, EMPTY);
  });
  it("a deck can be shared again by the friend (made decks may be shared; the copy is not special)", () => {
    const r = addSharedDeck(EMPTY, shared, T);
    assert.ok(canShare(r.data.decks[0]));
  });
});

describe("remembering codes on this device", () => {
  const mem = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  it("round-trips, and reads junk as nothing", () => {
    const s = mem();
    assert.deepEqual(readCodes(s, ADDED_KEY), {});
    writeCodes(s, ADDED_KEY, { [CODE]: "d_1" });
    assert.deepEqual(readCodes(s, ADDED_KEY), { [CODE]: "d_1" });
    s.m.set(ADDED_KEY, "{not json");
    assert.deepEqual(readCodes(s, ADDED_KEY), {});
    s.m.set(ADDED_KEY, JSON.stringify([1, 2]));
    assert.deepEqual(readCodes(s, ADDED_KEY), {});
    s.m.set(ADDED_KEY, JSON.stringify({ a: "x", b: 5 }));
    assert.deepEqual(readCodes(s, ADDED_KEY), { a: "x" });
    assert.deepEqual(readCodes(null, ADDED_KEY), {});
  });
  it("does not throw when storage is full or blocked", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
    assert.deepEqual(readCodes(blocked, ADDED_KEY), {});
    assert.doesNotThrow(() => writeCodes(blocked, ADDED_KEY, { a: "b" }));
  });
  it("detects a link that was already added, and lets it be added again once the copy is deleted", () => {
    const r = addSharedDeck(EMPTY, { title: "T", subjectHint: null, cardCount: 1, cards: [{ front: "q", back: "a" }] }, T);
    const codes = { [CODE]: r.deckId! };
    assert.equal(addedDeckFor(r.data, codes, CODE), r.deckId);
    assert.equal(addedDeckFor(r.data, codes, "other0000000000"), null);
    assert.equal(addedDeckFor({ decks: [] }, codes, CODE), null, "the copy was deleted");
  });
  it("finds the live link of a deck: the code must still be live when the list is known", () => {
    const codes = { [CODE]: "d_1", other0000000000: "d_2" };
    assert.equal(codeForDeck(codes, "d_1", new Set([CODE])), CODE);
    assert.equal(codeForDeck(codes, "d_1", new Set()), null, "stopped from another device");
    assert.equal(codeForDeck(codes, "d_1", null), CODE, "list not loaded (offline): the last known link");
    assert.equal(codeForDeck(codes, "d_9", null), null);
  });
});

describe("is sharing on in this project", () => {
  it("is on when the function answers, even to say not_found or bad_request", async () => {
    assert.equal(await probeSharing(fakeApi(() => ({ error: { message: "not_found", status: 400 } })).api), "on");
    assert.equal(await probeSharing(fakeApi(() => ({ error: { message: "bad_request", status: 400 } })).api), "on");
    assert.equal(await probeSharing(fakeApi(() => ({ data: { title: "x", cards: [] } })).api), "on");
  });
  it("asks with a well-formed code that cannot exist, and no sign-in", async () => {
    const { api, calls } = fakeApi(() => ({ error: { message: "not_found" } }), { user: null });
    await probeSharing(api);
    assert.equal(calls[0].name, SHARE_RPC.get.name);
    assert.deepEqual(calls[0].args, { p_code: PROBE_CODE });
    assert.ok(isShareCode(PROBE_CODE));
  });
  it("is off while the migration is not applied: a 404 PGRST202, or no project", async () => {
    assert.equal(await probeSharing(fakeApi(() => ({ error: { message: "Could not find the function public.get_shared_deck(p_code) in the schema cache", code: "PGRST202", status: 404 } })).api), "off");
    assert.equal(await probeSharing(fakeApi(() => ({ error: { message: "x", status: 404 } })).api), "off");
    assert.equal(await probeSharing(fakeApi(() => ({}), { configured: false }).api), "off");
  });
  it("is unknown when the connection fails or the server is down, so Share stays hidden and it asks again later", async () => {
    assert.equal(await probeSharing(fakeApi(() => ({ error: { message: "TypeError: Failed to fetch" } })).api), "unknown");
    assert.equal(await probeSharing(fakeApi(() => ({ error: { message: "bad gateway", status: 502 } })).api), "unknown");
    assert.equal(await probeSharing(fakeApi(() => ({ error: { message: "unauthorized", status: 401 } })).api), "unknown");
    const throws = { configured: true, userId: () => null, rpc: async () => { throw new Error("boom"); } } as Pick<Api, "configured" | "userId" | "rpc">;
    assert.equal(await probeSharing(throws), "unknown");
  });
  it("asks once per visit: concurrent callers share one question, a definite answer is remembered, an unknown one is not", async () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    let answer: ApiError | null = { message: "not_found" };
    const { api, calls } = fakeApi(() => (answer ? { error: answer } : {}));
    const probe = makeProbe(api, store);
    assert.equal(probe.peek(), null);
    const [a, b] = await Promise.all([probe.ask(), probe.ask()]);
    assert.deepEqual([a, b], ["on", "on"]);
    assert.equal(calls.length, 1);
    assert.equal(await probe.ask(), "on");
    assert.equal(calls.length, 1, "remembered");
    assert.equal(probe.peek(), "on");
    // another page load in the same tab: read from storage, no call
    const again = makeProbe(api, store);
    assert.equal(again.peek(), "on");
    assert.equal(await again.ask(), "on");
    assert.equal(calls.length, 1);
    // an unknown answer is not remembered
    const fresh = makeProbe(fakeApi(() => ({ error: { message: "Failed to fetch" } })).api, mem2());
    assert.equal(await fresh.ask(), "unknown");
    assert.equal(fresh.peek(), null);
    answer = null;
    function mem2() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; }
  });
  it("works with storage blocked", async () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const probe = makeProbe(fakeApi(() => ({ error: { message: "not_found" } })).api, blocked);
    assert.equal(await probe.ask(), "on");
    assert.equal(probe.peek(), "on");
    assert.equal(await makeProbe(fakeApi(() => ({ error: { message: "not_found" } })).api, null).ask(), "on");
  });
});

describe("the fetch transport", () => {
  const config = { url: "https://proj.supabase.co", key: "sb_publishable_abc" };
  function fakeFetch(status: number, body: unknown) {
    const seen: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    return { f, seen };
  }
  it("reads its project from the two variables accounts use", () => {
    assert.deepEqual(restConfig({ NEXT_PUBLIC_PLUMI_SUPABASE_URL: "https://p.supabase.co/", NEXT_PUBLIC_PLUMI_SUPABASE_KEY: " k " }), { url: "https://p.supabase.co", key: "k" });
    assert.equal(restConfig({}), null);
    assert.equal(restConfig({ NEXT_PUBLIC_PLUMI_SUPABASE_URL: "https://p.supabase.co" }), null);
    assert.equal(restConfig({ NEXT_PUBLIC_PLUMI_SUPABASE_URL: "javascript:alert(1)", NEXT_PUBLIC_PLUMI_SUPABASE_KEY: "k" }), null);
  });
  it("posts the rpc with the public key, uncached, and returns the body", async () => {
    const { f, seen } = fakeFetch(200, { title: "T" });
    const api = restApi(config, { fetch: f });
    const r = await api.rpc("get_shared_deck", { p_code: CODE });
    assert.deepEqual(r, { data: { title: "T" }, error: null });
    assert.equal(seen[0].url, "https://proj.supabase.co/rest/v1/rpc/get_shared_deck");
    assert.equal(seen[0].init.method, "POST");
    assert.equal(seen[0].init.cache, "no-store");
    assert.equal(JSON.parse(seen[0].init.body as string).p_code, CODE);
    const h = seen[0].init.headers as Record<string, string>;
    assert.equal(h.apikey, "sb_publishable_abc");
    assert.equal(h.authorization, undefined, "a publishable key is not a bearer token");
  });
  it("sends a legacy anon key (a JWT) as the bearer too", async () => {
    const { f, seen } = fakeFetch(200, null);
    await restApi({ url: config.url, key: "aaa.bbb.ccc" }, { fetch: f }).rpc("x", {});
    assert.equal((seen[0].init.headers as Record<string, string>).authorization, "Bearer aaa.bbb.ccc");
  });
  it("turns PostgREST's error body into an error with its message, code and status", async () => {
    const { f } = fakeFetch(400, { code: "P0001", message: "not_found", details: null, hint: null });
    assert.deepEqual(await restApi(config, { fetch: f }).rpc("get_shared_deck", {}), { data: null, error: { message: "not_found", code: "P0001", status: 400 } });
    const missing = fakeFetch(404, { code: "PGRST202", message: "Could not find the function public.get_shared_deck(p_code) in the schema cache" });
    const r = await restApi(config, { fetch: missing.f }).rpc("get_shared_deck", {});
    assert.equal(reasonFor(r.error!), "unavailable");
  });
  it("is a quiet failure when there is no project, no network or an unreadable answer", async () => {
    assert.equal((await restApi(null).rpc("x", {})).error?.message, "not configured");
    assert.equal(restApi(null).configured, false);
    const down = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    const r = await restApi(config, { fetch: down }).rpc("x", {});
    assert.equal(reasonFor(r.error!), "offline");
    const html = fakeFetch(502, "<html>bad gateway</html>");
    assert.equal(reasonFor((await restApi(config, { fetch: html.f }).rpc("x", {})).error!), "busy");
  });
  it("lets the service read a deck end to end", async () => {
    const { f } = fakeFetch(200, { title: "T", subject_hint: null, card_count: 1, cards: [{ front: "q", back: "a" }] });
    const r = await createSharing(restApi(config, { fetch: f })).get(CODE);
    assert.deepEqual(r, { ok: true, value: { title: "T", subjectHint: null, cardCount: 1, cards: [{ front: "q", back: "a" }] } });
  });
});
