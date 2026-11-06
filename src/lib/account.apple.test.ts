import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { memory, ORIGIN, SUPABASE, visited } from "./account.apple.setup";
import * as account from "./account";

/**
 * "Continue with Apple" and "Continue with Google": the real Supabase client, with the browser stubbed (account.apple.setup),
 * so what is checked is the address the student would actually be sent to. Nothing here reaches Supabase or Apple:
 * signInWithOAuth builds the authorize address and navigates; the navigation is caught.
 */
const asUrl = () => { assert.equal(visited.length, 1, "one trip away from the page"); return new URL(visited[0]); };
after(async () => { await account.supabase()?.auth.stopAutoRefresh(); });
beforeEach(() => { visited.length = 0; memory.clear(); });

describe("signInWithApple", () => {
  test("goes to Supabase's authorize address for apple, back to /auth/callback", async () => {
    const r = await account.signInWithApple("marks", "/question-bank/x?y=1");
    assert.deepEqual(r, { error: null });
    const u = asUrl();
    assert.equal(u.origin, SUPABASE);
    assert.equal(u.pathname, "/auth/v1/authorize");
    assert.equal(u.searchParams.get("provider"), "apple");
    const back = new URL(u.searchParams.get("redirect_to")!);
    assert.equal(back.origin, ORIGIN);
    assert.equal(back.pathname, "/auth/callback");
    assert.equal(back.searchParams.get("next"), "/question-bank/x?y=1");
    assert.equal(u.searchParams.get("code_challenge_method"), "s256");   // PKCE, as for Google
  });

  test("a next that leaves the site is replaced, as for Google", async () => {
    for (const bad of ["https://evil.example/", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null as unknown as string]) {
      visited.length = 0;
      await account.signInWithApple("header", bad);
      const back = new URL(asUrl().searchParams.get("redirect_to")!);
      assert.equal(back.origin, ORIGIN);
      const next = back.searchParams.get("next")!;
      assert.ok(next.startsWith("/") && !next.startsWith("//"), `next for ${JSON.stringify(bad)} was ${next}`);
    }
  });

  test("remembers how and why, so the callback can report it", async () => {
    await account.signInWithApple("library", "/");
    assert.equal(memory.get("plumi.signin.reason"), "apple:library");
  });

  test("Apple and Google differ only in the provider", async () => {
    await account.signInWithApple("header", "/question-bank");
    const apple = asUrl();
    visited.length = 0;
    await account.signInWithGoogle("header", "/question-bank");
    const google = asUrl();
    assert.equal(google.searchParams.get("provider"), "google");
    assert.equal(google.searchParams.get("redirect_to"), apple.searchParams.get("redirect_to"));
    assert.equal(memory.get("plumi.signin.reason"), "google:header");
  });

  test("a failure to start is an answer in Plumi's words, never the library's", async () => {
    const sb = account.supabase()!;
    const real = sb.auth.signInWithOAuth.bind(sb.auth);
    sb.auth.signInWithOAuth = (async () => ({ data: { provider: "apple", url: null }, error: { message: "Unsupported provider: provider is not enabled", status: 400 } })) as never;
    const r = await account.signInWithApple("header", "/");
    assert.match(r.error ?? "", /didn’t start/);
    assert.doesNotMatch(r.error ?? "", /provider|Unsupported|enabled/i);
    sb.auth.signInWithOAuth = (async () => { throw new Error("network down"); }) as never;
    const t = await account.signInWithApple("header", "/");
    assert.match(t.error ?? "", /didn’t start/);
    sb.auth.signInWithOAuth = real;
  });
});
