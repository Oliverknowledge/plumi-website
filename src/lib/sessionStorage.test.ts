import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CHUNK, cookieDomain, makeSessionStorage, type Legacy } from "./sessionStorage";

/** A cookie jar that behaves like a browser's for the attributes used here: Max-Age=0 deletes, Domain is recorded. */
function jar() {
  const store = new Map<string, { value: string; domain?: string; secure: boolean; sameSite?: string; path?: string }>();
  const writes: string[] = [];
  return {
    store, writes,
    read: () => [...store].map(([k, v]) => `${k}=${v.value}`).join("; "),
    write(cookie: string) {
      writes.push(cookie);
      const [pair, ...attrs] = cookie.split(";").map((s) => s.trim());
      const i = pair.indexOf("=");
      const name = pair.slice(0, i), value = pair.slice(i + 1);
      const get = (a: string) => attrs.find((x) => x.toLowerCase().startsWith(a.toLowerCase() + "="))?.split("=")[1];
      if (get("Max-Age") === "0") { store.delete(name); return; }
      store.set(name, { value, domain: get("Domain"), secure: attrs.includes("Secure"), sameSite: get("SameSite"), path: get("Path") });
    },
  };
}
const memory = (init: Record<string, string> = {}): Legacy & { m: Map<string, string> } => {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => m.get(k) ?? null, removeItem: (k) => void m.delete(k) };
};
const KEY = "plumi-auth";
const session = (pad = 0) => JSON.stringify({ access_token: "a".repeat(900 + pad), refresh_token: "r", user: { email: "sam@example.com", user_metadata: { full_name: "Zoë 学生 🎓" } } });

describe("which hosts share the cookie", () => {
  test("the website and the app share .tryplumi.app; everything else keeps its own", () => {
    for (const h of ["tryplumi.app", "www.tryplumi.app", "study.tryplumi.app", "STUDY.tryplumi.app"]) assert.equal(cookieDomain(h), ".tryplumi.app", h);
    for (const h of ["localhost", "study.localhost", "plumi-x.vercel.app", "tryplumi.app.evil.com", "nottryplumi.app", "plumi.app"]) assert.equal(cookieDomain(h), undefined, h);
  });
});

describe("the session cookie", () => {
  test("round-trips, including non-ASCII, and is written for .tryplumi.app, Secure and SameSite=Lax", () => {
    const j = jar();
    const s = makeSessionStorage({ jar: j, hostname: "study.tryplumi.app", secure: true });
    const v = session();
    s.setItem(KEY, v);
    assert.equal(s.getItem(KEY), v);
    const c = j.store.get(`${KEY}.0`)!;
    assert.deepEqual([c.domain, c.secure, c.sameSite, c.path], [".tryplumi.app", true, "Lax", "/"]);
  });
  test("what one host writes the other reads (same cookie jar, same domain)", () => {
    const j = jar();
    makeSessionStorage({ jar: j, hostname: "tryplumi.app", secure: true }).setItem(KEY, session());
    assert.equal(makeSessionStorage({ jar: j, hostname: "study.tryplumi.app", secure: true }).getItem(KEY), session());
  });
  test("a session bigger than a cookie is chunked, and no cookie is over the browser's limit", () => {
    const j = jar();
    const s = makeSessionStorage({ jar: j, hostname: "tryplumi.app", secure: true });
    const big = session(9000);
    s.setItem(KEY, big);
    assert.ok(j.store.size > 1, "chunked");
    for (const w of j.writes) assert.ok(w.length < 3800, `cookie of ${w.length} bytes`);
    assert.equal(s.getItem(KEY), big);
    assert.ok([...j.store.values()].every((c) => c.value.length <= CHUNK));
  });
  test("a smaller session later does not leave the old tail glued on", () => {
    const j = jar();
    const s = makeSessionStorage({ jar: j, hostname: "tryplumi.app", secure: true });
    s.setItem(KEY, session(9000));
    s.setItem(KEY, session());
    assert.equal(s.getItem(KEY), session());
    assert.equal([...j.store.keys()].filter((k) => k.startsWith(KEY)).length, 1);
  });
  test("removing deletes every chunk", () => {
    const j = jar();
    const s = makeSessionStorage({ jar: j, hostname: "tryplumi.app", secure: true });
    s.setItem(KEY, session(9000));
    s.removeItem(KEY);
    assert.equal(j.store.size, 0);
    assert.equal(s.getItem(KEY), null);
  });
  test("on localhost it is a plain cookie for that host: no Domain, and not Secure over http", () => {
    const j = jar();
    makeSessionStorage({ jar: j, hostname: "localhost", secure: false }).setItem(KEY, session());
    const c = j.store.get(`${KEY}.0`)!;
    assert.deepEqual([c.domain, c.secure], [undefined, false]);
  });
  test("other cookies in the jar are left alone, and a damaged one reads as signed out, not as a crash", () => {
    const j = jar();
    j.store.set("theme", { value: "dark", secure: false });
    const s = makeSessionStorage({ jar: j, hostname: "tryplumi.app", secure: true });
    s.setItem(KEY, session());
    s.removeItem(KEY);
    assert.equal(j.store.get("theme")?.value, "dark");
    j.store.set(`${KEY}.0`, { value: "!!!not base64!!!", secure: true });
    assert.equal(s.getItem(KEY), null);
  });
  test("an unrelated key is not mistaken for the session's chunks", () => {
    const j = jar();
    const s = makeSessionStorage({ jar: j, hostname: "tryplumi.app", secure: true });
    s.setItem(KEY, session());
    s.setItem(`${KEY}-code-verifier`, "verifier-123");
    assert.equal(s.getItem(KEY), session());
    assert.equal(s.getItem(`${KEY}-code-verifier`), "verifier-123");
    s.removeItem(`${KEY}-code-verifier`);
    assert.equal(s.getItem(KEY), session());
  });
});

describe("signed in before this change (localStorage)", () => {
  test("the session is moved to the cookie on first read, and the old copy removed", () => {
    const j = jar();
    const legacy = memory({ [KEY]: session() });
    const s = makeSessionStorage({ jar: j, hostname: "tryplumi.app", secure: true, legacy });
    assert.equal(s.getItem(KEY), session());
    assert.equal(legacy.m.has(KEY), false);
    assert.equal(makeSessionStorage({ jar: j, hostname: "study.tryplumi.app", secure: true }).getItem(KEY), session());
  });
  test("a cookie wins over an old localStorage copy", () => {
    const j = jar();
    const legacy = memory({ [KEY]: session(5) });
    const s = makeSessionStorage({ jar: j, hostname: "tryplumi.app", secure: true, legacy });
    s.setItem(KEY, session());
    assert.equal(s.getItem(KEY), session());
  });
  test("nothing anywhere is null", () => {
    assert.equal(makeSessionStorage({ jar: jar(), hostname: "tryplumi.app", secure: true, legacy: memory() }).getItem(KEY), null);
  });
});
