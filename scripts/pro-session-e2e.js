/**
 * A rejected sign-in must never read as the Free plan. Drives a built study app (accounts ON, pointing at a mock Supabase that
 * this script answers itself, so nothing real is touched and nothing is paid for):
 *
 *   NEXT_PUBLIC_PLUMI_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_PLUMI_SUPABASE_KEY=x npm run build
 *   npm start -- -p 3757 &            (then)   node scripts/pro-session-e2e.js http://127.0.0.1:3757
 *
 * Needs Playwright (`require("playwright")`, e.g. NODE_PATH=/opt/node22/lib/node_modules). Cases:
 *   1. the token is refused, a refresh gives a good one: Pro (one refresh, two asks, the second with the new token)
 *   2. the refresh token is plainly dead (400): signed out here, "Sign in to see your plan", never "Free plan"
 *   3. the refresh works but the server still refuses: Settings says the sign-in has run out (Sign out, no Free plan, no "iPad"), the locked tiles and the
 *      panel say so, no loop; Sign in signs out and goes to /sign-in, and signing in again turns it into Pro
 * Console errors fail it (ignored: the mock's own 400 and 401 loads, and Vercel's analytics scripts, which 404 on a local server).
 */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const BASE = process.argv[2] || "http://127.0.0.1:3757";
const SB = "http://127.0.0.1:54321";
const USER = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "founder@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const session = (token) => ({ access_token: token, refresh_token: `r-${token}`, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: USER });

/** One browser context with a mock Supabase. `accepts` is the set of tokens /api/pro-status takes; `refresh` says what the refresh endpoint does. */
async function open(browser, { accepts, refresh, seed = "tok-old" }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const log = { refresh: 0, asks: [], errors: [] };
  await ctx.addInitScript(([s, key]) => { try { if (s && !sessionStorage.getItem("seeded")) { localStorage.setItem(key, JSON.stringify(s)); sessionStorage.setItem("seeded", "1"); } } catch {} }, [seed ? session(seed) : null, "plumi-auth"]);
  await ctx.route(`${SB}/**`, async (route) => {
    const url = new URL(route.request().url());
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (url.pathname.endsWith("/token") && url.searchParams.get("grant_type") === "refresh_token") {
      log.refresh++;
      if (refresh === "dead") return json(400, { code: "refresh_token_not_found", error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found", message: "Invalid Refresh Token: Refresh Token Not Found" });
      return json(200, session(refresh === "good" ? "tok-new" : "tok-refused"));
    }
    if (url.pathname.endsWith("/token") && url.searchParams.get("grant_type") === "password") return json(200, session("tok-signed-in"));
    if (url.pathname.endsWith("/user")) return json(200, USER);
    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    return json(200, []);
  });
  await ctx.route("**/api/pro-status*", (route) => {
    const token = (route.request().headers().authorization || "").replace("Bearer ", "");
    log.asks.push(token);
    return accepts.includes(token)
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ pro: true, expiresAt: "2027-01-14T09:00:00Z", status: "active" }) })
      : route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "token" }) });
  });
  const page = await ctx.newPage();
  // (Ignored: the mock's own 400 and 401 loads, and Vercel's analytics scripts, which exist only on Vercel and 404 on a local server.)
  page.on("console", (m) => {
    const t = m.text(), at = m.location().url || "";
    if (m.type() === "error" && !/Failed to load resource.*\b(400|401)\b/.test(t) && !/_vercel\//.test(t + at)) log.errors.push(`${t} ${at}`);
  });
  page.on("pageerror", (e) => log.errors.push(String(e)));
  return { ctx, page, log };
}

const settingsText = async (page) => {
  await page.getByTestId("account-button").click();
  await page.getByTestId("pro-plan").waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="pro-plan"]')?.getAttribute("data-tone") !== "checking", null, { timeout: 15000 });
  return page.getByTestId("settings").innerText();
};

(async () => {
  const browser = await chromium.launch();
  try {
    // 1. refused once, a refresh fixes it
    {
      const { ctx, page, log } = await open(browser, { accepts: ["tok-new"], refresh: "good" });
      await page.goto(`${BASE}/study/flashcards`);
      const text = await settingsText(page);
      assert.match(text, /You have Plumi Pro/, "case 1: Pro after one refresh");
      assert.doesNotMatch(text, /Free plan/);
      assert.equal(log.refresh, 1, "case 1: exactly one refresh");
      assert.deepEqual(log.asks.slice(0, 2), ["tok-old", "tok-new"], "case 1: asked with the old token, then the new one");
      assert.deepEqual(log.errors, [], "case 1: console");
      await ctx.close();
      console.log("ok 1 refused, refreshed, Pro");
    }
    // 2. the refresh token is dead: signed out here, never Free
    {
      const { ctx, page, log } = await open(browser, { accepts: [], refresh: "dead" });
      await page.goto(`${BASE}/study/flashcards`);
      await page.waitForURL(/\/sign-in/, { timeout: 15000 });   // the app's gate sends a signed-out student to sign in
      assert.ok(await page.evaluate(() => !document.cookie.includes("plumi-auth") && !localStorage.getItem("plumi-auth")), "case 2: the dead session is gone from this browser");
      assert.ok(log.refresh >= 1 && log.refresh <= 2, `case 2: no refresh loop (${log.refresh})`);
      assert.deepEqual(log.errors, [], "case 2: console");
      await ctx.close();
      console.log("ok 2 dead refresh token signs out locally");
    }
    // 3. the refresh works, the server still says no: "session"
    {
      const { ctx, page, log } = await open(browser, { accepts: ["tok-signed-in"], refresh: "refused" });
      await page.goto(`${BASE}/study/flashcards`);
      const text = await settingsText(page);
      assert.match(text, /Your sign-in has run out\./);
      assert.match(text, /Sign out and sign in again to see your plan\./);
      assert.doesNotMatch(text, /Free plan|iPad|Plumi app|Check again/, "case 3: no Free plan and no 'bought in the app'");
      assert.equal(await page.getByTestId("pro-plan-signout").count(), 1);
      assert.equal(await page.getByTestId("pro-list").count(), 0, "case 3: no list of locks implying a plan");
      await page.waitForTimeout(1500);
      assert.equal(log.refresh, 1, "case 3: one refresh, no loop");
      assert.equal(log.asks.length, 2, `case 3: two asks, no loop (${log.asks})`);
      await page.getByTestId("settings-close").click();
      // the locked things say the same
      await page.getByTestId("mistakes-open").click();
      let how = await page.getByTestId("pro-panel-how").innerText();
      assert.equal(how, "Your sign-in has run out. Sign in again, then it will work here.");
      assert.equal(await page.getByTestId("pro-signin-again").count(), 1);
      await page.getByTestId("pro-back").click();
      await page.getByTestId("starters-open").click();
      await page.getByTestId("cat-group-ms").click();
      await page.locator('[data-testid^="cat-board-"]').first().click();
      const tile = page.locator('[data-testid^="cat-deck-"]').first();
      await tile.waitFor();
      assert.match(await tile.getAttribute("aria-label"), /, Pro$/, "case 3: the tile stays locked, with the Pro tag");
      await tile.click();
      how = await page.getByTestId("pro-panel-how").innerText();
      assert.equal(how, "Your sign-in has run out. Sign in again, then it will work here.");
      assert.doesNotMatch(await page.getByTestId("pro-panel").innerText(), /iPad|bought/);
      assert.equal(log.refresh, 1, "case 3: still one refresh after the taps");
      // Sign in: signs out first, then the sign-in page; a good sign-in makes it Pro
      await page.getByTestId("pro-signin-again").click();
      await page.waitForURL(/\/sign-in/, { timeout: 15000 });
      await page.getByLabel(/email/i).first().fill("founder@example.com");
      await page.getByLabel(/password/i).first().fill("correct horse battery");
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await page.waitForURL(/\/study/, { timeout: 15000 });
      const after = await settingsText(page);
      assert.match(after, /You have Plumi Pro/, "case 3: signing in again turns it into Pro");
      assert.doesNotMatch(after, /Free plan|sign-in has run out/);
      assert.deepEqual(log.errors, [], "case 3: console");
      await ctx.close();
      console.log("ok 3 sign-in has run out, then signed in again");
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
