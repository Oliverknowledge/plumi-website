import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { handleMarkScheme, isMsSlug, MS_SLUGS } from "../studyapp/markSchemeRoute";
import { bearer, cacheKeys, clearProCache, getProState, handleProStatus, infoFor, isLive, limited, proInfoFor, requirePro, sameOrigin, type ProDeps } from "./server";

beforeEach(() => clearProCache());
const NOW = Date.parse("2026-11-06T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const DAY = 86_400_000;
const UID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const TOKEN = "aaaa.bbbb.cccc";
const REQ = (h: Record<string, string> = { authorization: `Bearer ${TOKEN}` }, url = "http://x/api") => new Request(url, { headers: h });

describe("the entitlement rule (account_pro_live in migration 0127)", () => {
  it("active grants while expires_at is ahead", () => {
    assert.equal(isLive({ status: "active", expires_at: iso(NOW + DAY) }, NOW), true);
    assert.equal(isLive({ status: "active", expires_at: iso(NOW - 1) }, NOW), false);
    assert.equal(isLive({ status: "active", expires_at: iso(NOW) }, NOW), false, "expires_at must be in the future");
  });
  it("grace grants for two days after expires_at, no longer", () => {
    assert.equal(isLive({ status: "grace", expires_at: iso(NOW - DAY) }, NOW), true);
    assert.equal(isLive({ status: "grace", expires_at: iso(NOW - 2 * DAY - 1000) }, NOW), false);
  });
  it("expired and revoked never grant, whatever the date; no row, a bad date or an unknown status grant nothing", () => {
    assert.equal(isLive({ status: "expired", expires_at: iso(NOW + 30 * DAY) }, NOW), false);
    assert.equal(isLive({ status: "revoked", expires_at: iso(NOW + 30 * DAY) }, NOW), false);
    assert.equal(isLive(null, NOW), false);
    assert.equal(isLive(undefined, NOW), false);
    assert.equal(isLive({ status: "active", expires_at: "soon" }, NOW), false);
    assert.equal(isLive({ status: "trial", expires_at: iso(NOW + DAY) }, NOW), false);
  });
});

/** A fake Supabase: /auth/v1/user and /rest/v1/account_entitlements, recording what it was asked. */
function fake(opts: { user?: { id?: string; is_anonymous?: boolean } | number; rows?: unknown[] | number | "throw" } = {}) {
  clearProCache(); // every scenario starts with an empty cache (the same token is used throughout)
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const f: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.includes("/auth/v1/user")) {
      if (typeof opts.user === "number") return new Response("{}", { status: opts.user });
      return new Response(JSON.stringify(opts.user ?? { id: UID }), { status: 200 });
    }
    if (url.includes("/rest/v1/account_entitlements")) {
      if (opts.rows === "throw") throw new Error("net");
      if (typeof opts.rows === "number") return new Response("{}", { status: opts.rows });
      return new Response(JSON.stringify(opts.rows ?? []), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  };
  const deps: ProDeps = { env: { url: "https://p.example", key: "pub" }, fetch: f, now: () => NOW };
  return { deps, calls };
}
const PRO_ROW = [{ status: "active", expires_at: iso(NOW + DAY) }];

describe("who is Pro, asked of Supabase with the caller's own token", () => {
  it("pro: a live row of the caller's own", async () => {
    const { deps, calls } = fake({ rows: PRO_ROW });
    assert.equal((await infoFor(TOKEN, deps)).state, "pro");
    assert.ok(calls[1].url.includes(`user_id=eq.${UID}`) && calls[1].url.includes("account_entitlements"));
    assert.equal(calls[1].headers.Authorization, `Bearer ${TOKEN}`, "the caller's own token, so row-level security applies");
    assert.ok(calls.every((c) => !c.url.includes("account_pro")), "never the RPC: it would take a device slot");
  });
  it("free: no row, an expired or revoked one, or an anonymous user", async () => {
    assert.deepEqual(await infoFor(TOKEN, fake({ rows: [] }).deps), { state: "free", reason: "none" });
    assert.equal((await infoFor(TOKEN, fake({ rows: [{ status: "expired", expires_at: iso(NOW + DAY) }] }).deps)).reason, "expired");
    assert.equal((await infoFor(TOKEN, fake({ rows: [{ status: "revoked", expires_at: iso(NOW + DAY) }] }).deps)).reason, "revoked");
    assert.deepEqual(await infoFor(TOKEN, fake({ rows: [{ status: "active", expires_at: iso(NOW - DAY) }] }).deps), { state: "free", reason: "expired", expiresAt: iso(NOW - DAY) });
    const anon = fake({ user: { id: UID, is_anonymous: true }, rows: PRO_ROW });
    assert.deepEqual(await infoFor(TOKEN, anon.deps), { state: "free", reason: "anonymous" });
    assert.equal(anon.calls.length, 1, "an anonymous user never even gets the entitlement read");
  });
  it("another user's row is not trusted: the query is for the verified user only", async () => {
    const { deps, calls } = fake({ user: { id: UID }, rows: PRO_ROW });
    await infoFor(TOKEN, deps);
    assert.ok(!calls[1].url.includes("user_id=eq.00000000"), "only the id Supabase gave for this token");
  });
  it("bad_token: a token Supabase does not accept; unknown (never free): Supabase down, odd answers, no config", async () => {
    assert.deepEqual(await infoFor(TOKEN, fake({ user: 401 }).deps), { state: "free", reason: "bad_token" });
    for (const f of [fake({ user: 500 }), fake({ user: { id: "not-a-uuid" } }), fake({ rows: 500 }), fake({ rows: "throw" })]) assert.equal((await infoFor(TOKEN, f.deps)).state, "unknown");
    assert.equal((await infoFor(TOKEN, { ...fake().deps, env: null })).state, "unknown");
  });
  it("tells a Pro student's expiry and status (active, or grace)", async () => {
    assert.deepEqual(await infoFor(TOKEN, fake({ rows: PRO_ROW }).deps), { state: "pro", reason: "ok", expiresAt: PRO_ROW[0].expires_at, status: "active" });
    const g = [{ status: "grace", expires_at: iso(NOW - DAY) }];
    assert.deepEqual(await infoFor(TOKEN, fake({ rows: g }).deps), { state: "pro", reason: "ok", expiresAt: g[0].expires_at, status: "grace" });
  });
  it("reads only a bearer token that looks like a JWT", () => {
    assert.equal(bearer("Bearer aaa.bbb.ccc"), "aaa.bbb.ccc");
    assert.equal(bearer("bearer aaa.bbb.ccc"), null);
    assert.equal(bearer("Bearer nope"), null);
    assert.equal(bearer("Bearer aaa.bbb.ccc extra"), null);
    assert.equal(bearer("Bearer a b.c.d"), null);
    assert.equal(bearer(null), null);
    assert.equal(bearer(`Bearer ${"a".repeat(5000)}.b.c`), null);
  });
});

const CARDS = { v: 1, kind: "markscheme", cards: [["X.A", "Q?", "Both travel at the same speed"]] };
const load = async () => CARDS;

describe("GET /api/premade/markscheme/<spec>", () => {
  it("200 and the cards, only to a Pro account, never cached", async () => {
    const r = await handleMarkScheme(REQ(), "ocr-h556", fake({ rows: PRO_ROW }).deps, load);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), CARDS);
    assert.match(r.headers.get("cache-control") ?? "", /private, no-store/);
  });
  it("403 for a free account, with a tiny body and none of the cards", async () => {
    const r = await handleMarkScheme(REQ(), "ocr-h556", fake({ rows: [] }).deps, load);
    assert.equal(r.status, 403);
    const body = await r.text();
    assert.ok(body.length < 40 && !body.includes("Both travel"));
    assert.match(r.headers.get("cache-control") ?? "", /no-store/);
  });
  it("401 with no token or a token Supabase rejects; 400 for a bad spec (checked first); 503 when Supabase cannot be asked", async () => {
    assert.equal((await handleMarkScheme(REQ({}), "ocr-h556", fake({ rows: PRO_ROW }).deps, load)).status, 401);
    assert.equal((await handleMarkScheme(REQ({ authorization: "Bearer junk" }), "ocr-h556", fake({ rows: PRO_ROW }).deps, load)).status, 401);
    assert.equal((await handleMarkScheme(REQ(), "ocr-h556", fake({ user: 401 }).deps, load)).status, 401);
    for (const bad of ["", "..", "../x", "OCR-H556", "aqa-9999", "ocr-h556.json", undefined, 7]) assert.equal((await handleMarkScheme(REQ(), bad, fake({ rows: PRO_ROW }).deps, load)).status, 400, String(bad));
    assert.equal((await handleMarkScheme(REQ({}), "nope", fake().deps, load)).status, 400, "a bad spec is refused before anything else");
    assert.equal((await handleMarkScheme(REQ(), "ocr-h556", fake({ rows: 500 }).deps, load)).status, 503);
  });
  it("asks Supabase nothing for a bad spec, and loads nothing for a free account", async () => {
    const f = fake({ rows: PRO_ROW });
    await handleMarkScheme(REQ(), "../etc", f.deps, load);
    assert.equal(f.calls.length, 0);
    let loaded = 0;
    await handleMarkScheme(REQ(), "ocr-h556", fake({ rows: [] }).deps, async () => { loaded++; return CARDS; });
    assert.equal(loaded, 0, "the file is not even read for someone who is not Pro");
  });
  it("accepts exactly the ten specifications", () => {
    assert.equal(MS_SLUGS.length, 10);
    for (const s of MS_SLUGS) assert.ok(isMsSlug(s));
    assert.equal(isMsSlug("aqa-7402/../x"), false);
  });
  it("a light limit per token", () => {
    const t = "x.y.limit-test-token-zzzzzzzzzzzz";
    let blocked = 0;
    for (let i = 0; i < 70; i++) if (limited(t, NOW)) blocked++;
    assert.equal(blocked, 10);
    assert.equal(limited(t, NOW + 61_000), false, "the window ends");
  });
});

describe("GET /api/pro-status", () => {
  it("200 for Pro, 403 free, 401 no token, 503 when it cannot be told", async () => {
    assert.equal((await handleProStatus(REQ(), fake({ rows: PRO_ROW }).deps)).status, 200);
    assert.deepEqual(await (await handleProStatus(REQ(), fake({ rows: PRO_ROW }).deps)).json(), { pro: true, expiresAt: PRO_ROW[0].expires_at, status: "active" });
    const free = await handleProStatus(REQ(), fake({ rows: [] }).deps);
    assert.equal(free.status, 403);
    assert.deepEqual(await free.json(), { error: "pro", reason: "none" });
    const ended = await handleProStatus(REQ(), fake({ rows: [{ status: "expired", expires_at: iso(NOW - DAY) }] }).deps);
    assert.deepEqual(await ended.json(), { error: "pro", reason: "expired", expiresAt: iso(NOW - DAY) }, "says why, and when it ended");
    assert.equal((await handleProStatus(REQ({}), fake().deps)).status, 401);
    assert.equal((await handleProStatus(REQ(), fake({ rows: 500 }).deps)).status, 503);
  });
});

describe("the cards stay on the server", () => {
  const src = join(import.meta.dirname, "..", "..");
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  it("nothing but the server loader imports src/content/proDecks, and the loader is server-only", () => {
    const users = walk(src).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") && /(from|import\()\s*["'][^"']*content\/proDecks/.test(readFileSync(f, "utf8")));
    assert.deepEqual(users.map((f) => f.slice(src.length + 1)).sort(), ["lib/studyapp/proDecksLoader.ts"]);
    assert.match(readFileSync(join(src, "lib/studyapp/proDecksLoader.ts"), "utf8"), /^import "server-only";/m);
    const loaderUsers = walk(src).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") && /from\s*["'][^"']*proDecksLoader/.test(readFileSync(f, "utf8")));
    assert.deepEqual(loaderUsers.map((f) => f.slice(src.length + 1)).sort(), ["app/api/premade/markscheme/[spec]/route.ts"]);
  });
  it("the public folder holds no card text: the index has names and counts only", { skip: !existsSync(join(src, "content/premadeDecks/markscheme-index.json")) && "not built" }, () => {
    const idx = readFileSync(join(src, "content/premadeDecks/markscheme-index.json"), "utf8");
    assert.ok(!idx.includes("Both travel") && !idx.includes("[1 mark]") && !idx.includes("Also accept"));
    assert.deepEqual(walk(join(src, "content/premadeDecks")).filter((f) => f.includes("markscheme") && !f.endsWith("markscheme-index.json")), []);
  });
});

describe("the Pro layer: getProState and requirePro, for any route", () => {
  it("getProState: pro, free with why, and unknown; a missing or malformed token is free (no_token)", async () => {
    assert.equal((await getProState(REQ(), fake({ rows: PRO_ROW }).deps)).state, "pro");
    assert.deepEqual(await getProState(REQ(), fake({ rows: [] }).deps), { state: "free", reason: "none" });
    assert.deepEqual(await getProState(REQ({}), fake().deps), { state: "free", reason: "no_token" });
    assert.deepEqual(await getProState(REQ({ authorization: "Bearer junk" }), fake().deps), { state: "free", reason: "no_token" });
    assert.equal((await getProState(REQ(), fake({ rows: 500 }).deps)).state, "unknown");
  });
  it("requirePro: ok with the info for Pro; 403, 401, 503 otherwise, and a cross-origin call is refused", async () => {
    const ok = await requirePro(REQ(), fake({ rows: PRO_ROW }).deps);
    assert.ok(ok.ok && ok.info.state === "pro");
    const no = await requirePro(REQ(), fake({ rows: [] }).deps);
    assert.ok(!no.ok && no.response.status === 403);
    assert.equal((await requirePro(REQ({}), fake().deps) as { response: Response }).response.status, 401);
    assert.equal((await requirePro(REQ(), fake({ rows: 500 }).deps) as { response: Response }).response.status, 503, "slow or down is never 'free'");
    for (const h of [{ authorization: `Bearer ${TOKEN}`, origin: "https://evil.example" } as Record<string, string>, { authorization: `Bearer ${TOKEN}`, "sec-fetch-site": "cross-site" } as Record<string, string>]) {
      const r = await requirePro(REQ(h), fake({ rows: PRO_ROW }).deps) as { ok: boolean; response: Response };
      assert.ok(!r.ok && r.response.status === 403);
    }
    assert.equal(sameOrigin(REQ({ origin: "http://x" })), true);
    assert.equal(sameOrigin(REQ({})), true);
    assert.equal(sameOrigin(REQ({ origin: "not a url" })), false);
  });
  it("answers are cached for 30 seconds by a hash of the token: a page with several checks costs one read", async () => {
    const f = fake({ rows: PRO_ROW });
    await proInfoFor(TOKEN, f.deps); await proInfoFor(TOKEN, f.deps); await getProState(REQ(), f.deps);
    assert.equal(f.calls.length, 2, "one /user and one entitlement read for all three");
    let t = NOW;
    const late: ProDeps = { ...f.deps, now: () => t };
    t = NOW + 31_000;
    await proInfoFor(TOKEN, late);
    assert.equal(f.calls.length, 4, "asked again after 30 seconds");
    await proInfoFor(TOKEN, late, true);
    assert.equal(f.calls.length, 6, "fresh skips the cache (Check again after a purchase)");
    await getProState(REQ({ authorization: `Bearer ${TOKEN}` }, "http://x/api?fresh=1"), late);
    assert.equal(f.calls.length, 8, "?fresh=1 too");
  });
  it("only a real answer is cached: unknown and a rejected token are asked again", async () => {
    const f = fake({ rows: 500 });
    await proInfoFor(TOKEN, f.deps); await proInfoFor(TOKEN, f.deps);
    assert.equal(f.calls.length, 4);
    const bad = fake({ user: 401 });
    await proInfoFor("x.y.z", bad.deps); await proInfoFor("x.y.z", bad.deps);
    assert.equal(bad.calls.length, 2);
  });
  it("the cache never holds a token: its keys are hashes", async () => {
    const f = fake({ rows: PRO_ROW });
    await proInfoFor("secret.token.value", f.deps);
    assert.deepEqual(cacheKeys().map((k) => /^[0-9a-f]{64}$/.test(k)), [true]);
    assert.ok(!cacheKeys().join("").includes("secret"));
  });
  it("Supabase gets 4 seconds, then it is unknown (503), not free", async () => {
    const slow: ProDeps = { env: { url: "https://p.example", key: "k" }, now: () => NOW, timeoutMs: 30, fetch: (_u, init) => new Promise((_res, rej) => { init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))); }) as Promise<Response> };
    const t0 = Date.now();
    assert.equal((await infoFor(TOKEN, slow)).state, "unknown");
    assert.ok(Date.now() - t0 < 1000);
    assert.equal((await handleProStatus(REQ(), slow)).status, 503);
  });
});
