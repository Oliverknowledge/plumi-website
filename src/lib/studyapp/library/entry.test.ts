/**
 * npm run library:test   (node:test via tsx; no browser)
 *
 * The front door of the Grand Library: when it is shown, the hour and the season, the two truthful lines, the
 * order the room's art is fetched in (and that nothing there joins the lobby), and when the transition may go on.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { LobbyServers } from "../../social/lobby";
import {
  ART, HIDDEN_NOTE, LAMPS, NAMES_FRESH_MS, OUTRO, QUICK_RETURN_MS, ROOM_ART, ROOM_LAYOUT, entryMemory, friendsIn, coverScale, friendsLine, goDelay, goMs, lampLayers, liveLine,
  namesAreFresh, preloadRoom, readyToGo, seasonOf, shouldShowEntry, timeOfDay, type PreloadDeps,
} from "./entry";

const servers = (rows: [number, number, number][]): LobbyServers => ({ cap: 60, you: null, empty: null, max: 20, servers: rows.map(([shard, here, friends]) => ({ shard, here, friends })) });

describe("when the door is shown", () => {
  it("shows on a fresh load and after a long time away; skips only a short step out", () => {
    const t = 1_000_000;
    assert.equal(shouldShowEntry({ leftAt: null, now: t }), true);
    assert.equal(shouldShowEntry({ leftAt: t - 60_000, now: t }), false);
    assert.equal(shouldShowEntry({ leftAt: t - (QUICK_RETURN_MS - 1), now: t }), false);
    assert.equal(shouldShowEntry({ leftAt: t - QUICK_RETURN_MS, now: t }), true);
    assert.equal(shouldShowEntry({ leftAt: t - 3 * 3_600_000, now: t }), true);
  });
  it("a forced door (the demo) always shows, and a clock that went backwards is not a skip", () => {
    assert.equal(shouldShowEntry({ leftAt: 5, now: 6, forced: true }), true);
    assert.equal(shouldShowEntry({ leftAt: 100, now: 50 }), true);
  });
  it("the tab remembers stepping out, and being in the room is not stepping out", () => {
    entryMemory.reset();
    assert.equal(entryMemory.leftAt, null);
    entryMemory.entered();
    assert.equal(entryMemory.leftAt, null);
    entryMemory.left(1234);
    assert.equal(entryMemory.leftAt, 1234);
    entryMemory.entered();                       // back in (and a second room at once, as React's strict mode does in development)
    entryMemory.entered();
    assert.equal(entryMemory.leftAt, null);
    entryMemory.left(2000);
    assert.equal(entryMemory.leftAt, null);      // one room is still open
    entryMemory.left(3000);
    assert.equal(entryMemory.leftAt, 3000);
    entryMemory.reset();
  });
});

describe("the hour and the season", () => {
  it("the hour picks dawn, day, evening or night, on the edges and round the clock", () => {
    const want: Record<number, string> = { 0: "night", 4: "night", 5: "dawn", 7: "dawn", 8: "day", 12: "day", 16: "day", 17: "evening", 19: "evening", 20: "night", 23: "night" };
    for (const [h, t] of Object.entries(want)) assert.equal(timeOfDay(Number(h)), t, `hour ${h}`);
    assert.equal(timeOfDay(24), "night");
    assert.equal(timeOfDay(29), "dawn");          // 29 mod 24 = 5
    assert.equal(timeOfDay(-1), "night");
    assert.equal(timeOfDay(7.99), "dawn");
  });
  it("the months fall into the UK's four seasons", () => {
    assert.deepEqual([0, 1, 2, 4, 5, 7, 8, 10, 11].map(seasonOf), ["winter", "winter", "spring", "spring", "summer", "summer", "autumn", "autumn", "winter"]);
  });
});

describe("the live line", () => {
  it("says how many are studying, singular and plural, with thousands separated", () => {
    assert.equal(liveLine(1), "1 student studying right now");
    assert.equal(liveLine(47), "47 students studying right now");
    assert.equal(liveLine(1204), "1,204 students studying right now");
  });
  it("is honest about an empty library, and says nothing when it does not know", () => {
    assert.equal(liveLine(0), "The library is quiet. Be the first in");
    assert.equal(liveLine(null), null);
    assert.equal(liveLine(-3), null);
    assert.equal(liveLine(Number.NaN), null);
  });
  it("sums the servers' own counts", () => {
    const s = servers([[1, 30, 2], [2, 12, 0], [3, 5, 1]]);
    assert.equal(friendsIn(s), 3);
    assert.equal(friendsIn(servers([])), 0);
    assert.equal(friendsIn(servers([[1, 4, -2]])), 0);
  });
});

describe("the friends line", () => {
  it("names friends when the page knows them, up to three, then counts the rest", () => {
    assert.equal(friendsLine(1, ["Maya"]), "Maya is in");
    assert.equal(friendsLine(2, ["Maya", "Josh"]), "Maya and Josh are in");
    assert.equal(friendsLine(3, ["Maya", "Josh", "Ava"]), "Maya, Josh and Ava are in");
    assert.equal(friendsLine(5, ["Maya", "Josh", "Ava", "Sam", "Kit"]), "Maya, Josh and 3 more are in");
  });
  it("counts them when names are not known, or no longer agree with the server's count", () => {
    assert.equal(friendsLine(1, null), "1 friend is in");
    assert.equal(friendsLine(4, null), "4 friends are in");
    assert.equal(friendsLine(2, ["Maya"]), "2 friends are in");
    assert.equal(friendsLine(1, ["Maya", "Josh"]), "1 friend is in");
    assert.equal(friendsLine(1, ["  "]), "1 friend is in");
  });
  it("says nothing for nobody or an unknown count", () => {
    assert.equal(friendsLine(0, []), null);
    assert.equal(friendsLine(null, ["Maya"]), null);
    assert.equal(friendsLine(-1, null), null);
  });
  it("trusts names only just after the room published them", () => {
    assert.equal(namesAreFresh(null, 10), false);
    assert.equal(namesAreFresh(1000, 1000 + NAMES_FRESH_MS - 1), true);
    assert.equal(namesAreFresh(1000, 1000 + NAMES_FRESH_MS), false);
  });
  it("no student-facing line has an em dash, and the hidden note is one short sentence", () => {
    const all = [liveLine(0), liveLine(1), liveLine(9), friendsLine(1, null), friendsLine(3, null), friendsLine(1, ["Maya"]), friendsLine(6, ["a", "b", "c", "d", "e", "f"]), HIDDEN_NOTE];
    for (const l of all) assert.ok(l && !/[—–]/.test(l), String(l));
    assert.ok(HIDDEN_NOTE.length < 48);
  });
});

describe("getting the room ready", () => {
  const deps = (log: string[], over: Partial<PreloadDeps> = {}): PreloadDeps => ({
    engine: async () => { log.push("engine"); return {}; },
    image: async (u) => { log.push(u); return {}; },
    json: async (u) => { log.push(u); return {}; },
    people: async () => { log.push("people"); return true; },
    ...over,
  });
  it("asks for the engine, the layout and the four pictures, then the people layers", async () => {
    const log: string[] = [];
    const r = await preloadRoom(deps(log));
    assert.deepEqual(r.failed, []);
    assert.equal(r.loaded.length, 7);
    assert.equal(log[log.length - 1], "people");
    assert.deepEqual([...log.slice(0, -1)].sort(), ["engine", ROOM_LAYOUT, ...ROOM_ART].sort());
  });
  it("starts the people layers only after the first frame's art is in", async () => {
    const seen: string[] = [];
    let release!: () => void;
    const hold = new Promise<void>((r) => { release = r; });
    const p = preloadRoom(deps([], {
      image: async (u) => { if (u.endsWith("bg.png")) await hold; seen.push(u); },
      people: async () => { seen.push(`people after ${seen.length} of ${ROOM_ART.length}`); return true; },
    }));
    await new Promise((r) => setTimeout(r, 5));
    assert.ok(!seen.some((s) => s.startsWith("people")), "people must wait for bg.png");
    release();
    await p;
    assert.equal(seen[seen.length - 1], `people after ${ROOM_ART.length} of ${ROOM_ART.length}`);
  });
  it("never throws: a failing file is reported and the rest still load", async () => {
    const r = await preloadRoom(deps([], {
      image: async (u) => { if (u.endsWith("anims.png")) throw new Error("offline"); },
      people: async () => false,
      engine: async () => { throw new Error("chunk"); },
    }));
    assert.deepEqual([...r.failed].sort(), ["/library/anims.png", "engine", "people"].sort());
    assert.ok(r.loaded.includes("/library/bg.png") && r.loaded.includes("layout"));
  });
  it("is given nothing that joins a library: the deps are art and code only", () => {
    const keys: (keyof PreloadDeps)[] = ["engine", "image", "json", "people", "now"];
    assert.ok(keys.every((k) => !/lobby|join|social/i.test(k)));
  });
  it("names real files", () => {
    for (const u of [...ROOM_ART, ROOM_LAYOUT]) assert.ok(existsSync(`public${u}`) || existsSync(new URL(`../../../../public${u}`, import.meta.url)), u);
  });
});

describe("the transition", () => {
  const base = { reduced: false, quick: false };
  it("holds the press for its moment, and waits for the room to be drawn", () => {
    assert.equal(readyToGo({ ...base, elapsed: 100, ready: true }), false);
    assert.equal(readyToGo({ ...base, elapsed: OUTRO.press, ready: false }), false);
    assert.equal(readyToGo({ ...base, elapsed: OUTRO.press, ready: true }), true);
  });
  it("goes at once, once the room is drawn, when motion is reduced or the student only stepped out", () => {
    assert.equal(readyToGo({ reduced: true, quick: false, elapsed: 0, ready: true }), true);
    assert.equal(readyToGo({ reduced: false, quick: true, elapsed: 0, ready: true }), true);
    assert.equal(readyToGo({ reduced: true, quick: true, elapsed: 0, ready: false }), false);
  });
  it("says how long to wait, never past the give-up", () => {
    assert.equal(goDelay({ ...base, elapsed: 100, ready: true }), OUTRO.press - 100);
    assert.equal(goDelay({ ...base, elapsed: 100, ready: false }), OUTRO.giveUp - 100);
    assert.equal(goDelay({ ...base, elapsed: 9999, ready: false }), 0);
    assert.equal(goDelay({ reduced: true, quick: false, elapsed: 0, ready: true }), 0);
  });
  it("gives up waiting for a room that never draws, so nobody is stuck at the door", () => {
    assert.equal(readyToGo({ ...base, elapsed: OUTRO.giveUp - 1, ready: false }), false);
    assert.equal(readyToGo({ ...base, elapsed: OUTRO.giveUp, ready: false }), true);
  });
  it("is about a second in all: the press plus the walk, between 0.9 and 1.3 s", () => {
    const whole = OUTRO.press + goMs(base);
    assert.ok(whole >= 900 && whole <= 1300, String(whole));
    assert.equal(goMs({ reduced: true, quick: false }), OUTRO.reduced);
    assert.equal(goMs({ reduced: false, quick: true }), OUTRO.quick);
    assert.ok(goMs({ reduced: true, quick: true }) <= OUTRO.quick);
  });
});

describe("the lamplight behind the door", () => {
  it("is the room's own lights: same places, strengths and colours as public/library/layout.json", () => {
    const L = JSON.parse(readFileSync(new URL("../../../../public/library/layout.json", import.meta.url), "utf8")) as { lights: { x: number; y: number; r: number; k: number; rgb: number[]; fire: boolean }[] };
    assert.deepEqual(LAMPS.map((l) => [...l]), L.lights.map((l) => [l.x, l.y, l.r, l.k, ...l.rgb, l.fire ? 1 : 0]));
  });
  it("is three layers, every lamp in exactly one, drawn in the art's own pixels", () => {
    const { fire, tables, steady } = lampLayers();
    const count = (s: string) => (s.match(/radial-gradient/g) ?? []).length;
    assert.equal(count(fire) + count(tables) + count(steady), LAMPS.length);
    assert.equal(count(fire), 1);
    assert.equal(count(tables), 12);
    assert.ok([fire, tables, steady].every((s) => s.includes("var(--en-k)") && !/NaN|undefined/.test(s)));
  });
});

describe("the art behind the door", () => {
  it("is drawn at whole multiples of the art, and always covers the window it is in", () => {
    const sizes: [number, number][] = [[320, 568], [390, 844], [844, 390], [768, 1024], [1024, 1366], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440], [3440, 1440], [1080, 2400]];
    for (const [w, h] of sizes) {
      const k = coverScale(w, h);
      assert.ok(Number.isInteger(k) && k >= 2, `${w}x${h} k=${k}`);
      const top = h * ART.focusAt - ART.focusY * k, bottom = top + ART.h * k;
      assert.ok(top <= 0 && bottom >= h, `${w}x${h}: vertical cover ${top} to ${bottom}`);
      assert.ok(ART.w * k >= w, `${w}x${h}: horizontal cover`);
    }
  });
  it("grows with the window and never gets absurd", () => {
    assert.equal(coverScale(1280, 800), 2);
    assert.ok(coverScale(2560, 1440) <= 3);
    assert.ok(coverScale(5120, 2880) <= 6);
  });
});
