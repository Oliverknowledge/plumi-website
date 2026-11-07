import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { addOwnPaper, cleanLink, cleanTitle, parseOwnPapers, readOwnPapers, removeOwnPaper, updateOwnPaper } from "./ownPapers";

const BOARD = "/past-papers/a-level-maths/aqa";
const OTHER = "/past-papers/a-level-maths/edexcel";

let stored = new Map<string, string>();
let blocked = false;

/** Stands in for the browser, with a switch for storage that throws (some private modes). */
function fakeBrowser() {
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => { if (blocked) throw new Error("blocked"); return stored.get(key) ?? null; },
      setItem: (key: string, value: string) => { if (blocked) throw new Error("blocked"); stored.set(key, value); },
    },
  };
}

beforeEach(() => { stored = new Map(); blocked = false; fakeBrowser(); });

test("web links pass, and one typed without https:// gets it", () => {
  assert.equal(cleanLink(""), "");
  assert.equal(cleanLink("   "), "");
  assert.equal(cleanLink("https://drive.google.com/file/d/abc/view"), "https://drive.google.com/file/d/abc/view");
  assert.equal(cleanLink("  drive.google.com/file/d/abc "), "https://drive.google.com/file/d/abc");
  assert.equal(cleanLink("http://school.example/set1.pdf"), "http://school.example/set1.pdf");
});

test("anything that isn't a web link never reaches an href", () => {
  const bad = [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x",
    "file:///Users/me/set1.pdf", "C:\\Users\\me\\set1.pdf", "mailto:me@example.com", "blob:https://example.com/x",
    "my paper", "paper", "https://user:pass@example.com", `https://example.com/${"a".repeat(2000)}`,
  ];
  for (const link of bad) assert.equal(cleanLink(link), null, link);
});

test("names are tidied and capped", () => {
  assert.equal(cleanTitle("  Practice   paper\tSet 1 "), "Practice paper Set 1");
  assert.equal(cleanTitle("   "), "");
  assert.equal(cleanTitle("x".repeat(200)).length, 80);
});

test("stored data that is broken or tampered with is dropped, not trusted", () => {
  assert.deepEqual(parseOwnPapers(null), {});
  assert.deepEqual(parseOwnPapers("not json"), {});
  assert.deepEqual(parseOwnPapers("[1,2]"), {});
  assert.deepEqual(parseOwnPapers('{"a":"nope"}'), {});
  const parsed = parseOwnPapers(JSON.stringify({
    [BOARD]: [
      { id: "1", title: "Set 1", url: "javascript:alert(1)" },
      { id: "1", title: "Same id again" },
      { id: "2", title: "   " },
      { title: "No id" },
      null,
      { id: "3", title: "Set 3", url: "https://example.com/x" },
    ],
  }));
  assert.deepEqual(parsed[BOARD], [{ id: "1", title: "Set 1" }, { id: "3", title: "Set 3", url: "https://example.com/x" }]);
});

test("add, rename and delete keep to one board, and the id stays so the tick stays", () => {
  const a = addOwnPaper(BOARD, "Set 1");
  const b = addOwnPaper(BOARD, "Set 2", "https://example.com/2");
  addOwnPaper(OTHER, "Elsewhere");
  assert.deepEqual(readOwnPapers(BOARD).map(p => p.title), ["Set 1", "Set 2"]);

  updateOwnPaper(BOARD, a, "Practice Set 1", "https://example.com/1");
  assert.deepEqual(readOwnPapers(BOARD)[0], { id: a, title: "Practice Set 1", url: "https://example.com/1" });

  updateOwnPaper(BOARD, b, "Set 2");
  assert.equal(readOwnPapers(BOARD)[1].url, undefined);

  removeOwnPaper(BOARD, a);
  assert.deepEqual(readOwnPapers(BOARD).map(p => p.id), [b]);
  assert.deepEqual(readOwnPapers(OTHER).map(p => p.title), ["Elsewhere"]);
});

test("the snapshot stays the same array until something changes, as useSyncExternalStore needs", () => {
  addOwnPaper(BOARD, "Set 1");
  assert.equal(readOwnPapers(BOARD), readOwnPapers(BOARD));
  assert.equal(readOwnPapers(OTHER), readOwnPapers(OTHER));
  const before = readOwnPapers(BOARD);
  addOwnPaper(BOARD, "Set 2");
  assert.notEqual(readOwnPapers(BOARD), before);
});

test("removing a board's last entry leaves nothing behind for it", () => {
  const a = addOwnPaper(BOARD, "Set 1");
  removeOwnPaper(BOARD, a);
  assert.deepEqual(JSON.parse(stored.get("plumi-papers-own") ?? "{}"), {});
});

test("with storage blocked, entries still work for this page", () => {
  blocked = true;
  const a = addOwnPaper("/blocked", "Set 1");
  assert.deepEqual(readOwnPapers("/blocked").map(p => p.title), ["Set 1"]);
  removeOwnPaper("/blocked", a);
  assert.deepEqual(readOwnPapers("/blocked"), []);
});
