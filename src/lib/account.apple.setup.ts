/**
 * A browser, stubbed just enough for the real Supabase client to run in node (account.apple.test.ts imports this first:
 * lib/account reads its environment when it loads, so this has to be in place before it).
 */
export const ORIGIN = "https://tryplumi.app";
export const SUPABASE = "https://example-project.supabase.co";
process.env.NEXT_PUBLIC_PLUMI_SUPABASE_URL = SUPABASE;
process.env.NEXT_PUBLIC_PLUMI_SUPABASE_KEY = "sb_publishable_test";

const cookies = new Map<string, string>();
export const memory = new Map<string, string>();
const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v), removeItem: (k: string) => void memory.delete(k) };
export const visited: string[] = [];
const g = globalThis as Record<string, unknown>;
g.window = g;
g.document = {
  get cookie() { return [...cookies].map(([k, v]) => `${k}=${v}`).join("; "); },
  set cookie(c: string) { const [pair] = c.split(";"); const i = pair.indexOf("="); const [k, v] = [pair.slice(0, i), pair.slice(i + 1)]; if (/max-age=0/i.test(c)) cookies.delete(k); else cookies.set(k, v); },
  addEventListener() {}, removeEventListener() {},
};
g.localStorage = storage;
g.sessionStorage = storage;
g.location = { origin: ORIGIN, hostname: "tryplumi.app", protocol: "https:", pathname: "/sign-in", search: "", assign: (u: string) => void visited.push(u), replace: (u: string) => void visited.push(u), set href(u: string) { visited.push(u); }, get href() { return ORIGIN; } };
// The client keeps a refresh timer; unref'd, it cannot hold the test process open.
for (const name of ["setInterval", "setTimeout"] as const) {
  const real = globalThis[name] as (...a: unknown[]) => { unref?: () => void };
  g[name] = (...a: unknown[]) => { const t = real(...a); t.unref?.(); return t; };
}
// Node has a BroadcastChannel; the client would open one to tell other tabs about sign-ins, and that holds the process open.
g.BroadcastChannel = undefined;
g.addEventListener = () => {};
g.removeEventListener = () => {};

