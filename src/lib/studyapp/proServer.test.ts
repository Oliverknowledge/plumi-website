import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { bearer, handleMarkScheme, handleProStatus, isLive, isMsSlug, limited, MS_SLUGS, verdictFor, type ProDeps } from "./proServer";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const DAY = 86_400_000;
const UID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const TOKEN = "aaaa.bbbb.cccc";
const REQ = (h: Record<string, string> = { authorization: `Bearer ${TOKEN}` }) => new Request("http://x/api", { headers: h });

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
    assert.equal(await verdictFor(TOKEN, deps), "pro");
    assert.ok(calls[1].url.includes(`user_id=eq.${UID}`) && calls[1].url.includes("account_entitlements"));
    assert.equal(calls[1].headers.Authorization, `Bearer ${TOKEN}`, "the caller's own token, so row-level security applies");
    assert.ok(calls.every((c) => !c.url.includes("account_pro")), "never the RPC: it would take a device slot");
  });
  it("free: no row, an expired or revoked one, or an anonymous user", async () => {
    assert.equal(await verdictFor(TOKEN, fake({ rows: [] }).deps), "free");
    assert.equal(await verdictFor(TOKEN, fake({ rows: [{ status: "expired", expires_at: iso(NOW + DAY) }] }).deps), "free");
    assert.equal(await verdictFor(TOKEN, fake({ rows: [{ status: "revoked", expires_at: iso(NOW + DAY) }] }).deps), "free");
    assert.equal(await verdictFor(TOKEN, fake({ rows: [{ status: "active", expires_at: iso(NOW - DAY) }] }).deps), "free");
    const anon = fake({ user: { id: UID, is_anonymous: true }, rows: PRO_ROW });
    assert.equal(await verdictFor(TOKEN, anon.deps), "free");
    assert.equal(anon.calls.length, 1, "an anonymous user never even gets the entitlement read");
  });
  it("another user's row is not trusted: the query is for the verified user only", async () => {
    const { deps, calls } = fake({ user: { id: UID }, rows: PRO_ROW });
    await verdictFor(TOKEN, deps);
    assert.ok(!calls[1].url.includes("user_id=eq.00000000"), "only the id Supabase gave for this token");
  });
  it("unauth: a token Supabase does not accept; error: Supabase down, odd answers, no config", async () => {
    assert.equal(await verdictFor(TOKEN, fake({ user: 401 }).deps), "unauth");
    assert.equal(await verdictFor(TOKEN, fake({ user: 500 }).deps), "error");
    assert.equal(await verdictFor(TOKEN, fake({ user: { id: "not-a-uuid" } }).deps), "error");
    assert.equal(await verdictFor(TOKEN, fake({ rows: 500 }).deps), "error");
    assert.equal(await verdictFor(TOKEN, fake({ rows: "throw" }).deps), "error");
    assert.equal(await verdictFor(TOKEN, { ...fake().deps, env: null }), "error");
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
    assert.deepEqual(await (await handleProStatus(REQ(), fake({ rows: PRO_ROW }).deps)).json(), { pro: true });
    assert.equal((await handleProStatus(REQ(), fake({ rows: [] }).deps)).status, 403);
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
