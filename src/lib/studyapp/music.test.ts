/**
 * npm run app:test
 *
 * Spotify is not fetched until the student reaches for the record (the Grand Library) or the browser is idle (the
 * quiet pages), and a tap then starts the music as soon as it is ready. Browser globals are stood in for.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

interface El { tag: string; src?: string; parentElement: El | null; children: El[]; appendChild(c: El): El; replaceWith(): void }
const el = (tag: string): El => ({ tag, parentElement: null, children: [], appendChild(c) { c.parentElement = this; this.children.push(c); return c; }, replaceWith() { /* the plain player */ } });

let scripts: El[];
let idle: (() => void)[];
let timers: (() => void)[];
const g = globalThis as unknown as Record<string, unknown>;

function browser(pathname: string) {
  scripts = []; idle = []; timers = [];
  const head = el("head");
  g.window = { location: { pathname }, requestIdleCallback: (f: () => void) => idle.push(f), onSpotifyIframeApiReady: undefined };
  g.document = { createElement: (t: string) => { const e = el(t); if (t === "script") scripts.push(e); return e; }, head: { appendChild: (c: El) => head.appendChild(c) } };
  g.setTimeout = ((f: () => void) => { timers.push(f); return timers.length; }) as unknown;
  g.clearTimeout = (() => { /* none */ }) as unknown;
  return head;
}

let n = 0;
const fresh = async () => (await import(`./music?case=${n++}`)) as typeof import("./music");
const realSetTimeout = globalThis.setTimeout, realClear = globalThis.clearTimeout;
beforeEach(() => { n += 0; });
afterEach(() => { g.setTimeout = realSetTimeout; g.clearTimeout = realClear; delete g.window; delete g.document; });

describe("the record player and Spotify", () => {
  it("in the Grand Library asks Spotify for nothing until a hand is on the record", async () => {
    browser("/study/library");
    const { lofi } = await fresh();
    lofi().attach(el("div") as unknown as HTMLElement);
    assert.equal(idle.length, 0, "no idle fetch in the library");
    assert.equal(scripts.length, 0);
    timers.splice(0).forEach((f) => f());
    assert.equal(scripts.length, 0, "and no timer fetches it either");
  });

  it("on the app host's /library too", async () => {
    browser("/library");
    const { lofi } = await fresh();
    lofi().attach(el("div") as unknown as HTMLElement);
    assert.equal(idle.length + timers.length, 0);
  });

  it("a tap fetches Spotify's script, shows the record getting ready, and plays when the player is there", async () => {
    browser("/study/library");
    const { lofi } = await fresh();
    lofi().attach(el("div") as unknown as HTMLElement);
    lofi().toggle();
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].src, "https://open.spotify.com/embed/iframe-api/v1");
    assert.equal(lofi().state.wanted, true);
    assert.equal(lofi().state.loading, true, "the disc spins while it loads");
    const calls: string[] = [];
    const controller = { loadUri: () => calls.push("load"), play: () => calls.push("play"), pause: () => calls.push("pause"), addListener: () => { /* */ } };
    (g.window as { onSpotifyIframeApiReady: (a: unknown) => void }).onSpotifyIframeApiReady({ createController: (_e: unknown, _o: unknown, ready: (c: typeof controller) => void) => ready(controller) });
    assert.deepEqual(calls, ["play"], "starts as soon as it is ready, with no second tap");
    assert.equal(lofi().state.loading, false);
  });

  it("a second tap while it loads stops it, and it then does not start by itself", async () => {
    browser("/study/library");
    const { lofi } = await fresh();
    lofi().attach(el("div") as unknown as HTMLElement);
    lofi().toggle();
    lofi().toggle();
    assert.equal(lofi().state.wanted, false);
    assert.equal(lofi().state.loading, false);
    const calls: string[] = [];
    const controller = { loadUri: () => calls.push("load"), play: () => calls.push("play"), pause: () => calls.push("pause"), addListener: () => { /* */ } };
    (g.window as { onSpotifyIframeApiReady: (a: unknown) => void }).onSpotifyIframeApiReady({ createController: (_e: unknown, _o: unknown, ready: (c: typeof controller) => void) => ready(controller) });
    assert.deepEqual(calls, []);
  });

  it("reaching for the record (pointer or focus) gets Spotify on its way without playing anything", async () => {
    browser("/study/library");
    const { lofi } = await fresh();
    lofi().attach(el("div") as unknown as HTMLElement);
    lofi().warm();
    lofi().warm();
    assert.equal(scripts.length, 1, "once");
    assert.equal(lofi().state.wanted, false);
    assert.equal(lofi().state.loading, false, "not spinning: nobody asked for music");
  });

  it("on the quiet pages gets it ready when the browser is idle, so the tap is instant", async () => {
    browser("/study");
    const { lofi } = await fresh();
    lofi().attach(el("div") as unknown as HTMLElement);
    assert.equal(scripts.length, 0, "not at attach");
    assert.equal(idle.length, 1);
    idle[0]();
    assert.equal(scripts.length, 1);
  });
});
