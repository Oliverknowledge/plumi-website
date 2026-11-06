import assert from "node:assert/strict";
import { mock, test } from "node:test";

/**
 * The saved-questions half of the account sync, against a stand-in for Supabase: what comes
 * down, what goes up, and that one student's notes never reach another's account.
 */

type Row = { user_id: string; part_id: string; subject: string; bookmarked: boolean; note: string; updated_at: string };
const db = new Map<string, Row>();
let missingTable = false;
const upserts: Row[][] = [];

function savedTable() {
  const table = {
    select: () => table,
    eq: () => table,
    order: () => table,
    range: async (from: number, to: number) => missingTable
      ? { data: null, error: { message: "no such table" } }
      : { data: [...db.values()].filter(r => r.user_id === signedIn).slice(from, to + 1), error: null },
    upsert: async (rows: Row[]) => {
      if (missingTable) return { error: { message: "no such table" } };
      upserts.push(rows);
      for (const r of rows) db.set(`${r.user_id}|${r.part_id}`, r);
      return { error: null };
    },
  };
  return table;
}
const attemptTable = () => {
  const table = { select: () => table, eq: () => table, order: () => table, range: async () => ({ data: [], error: null }) };
  return table;
};

let signedIn: string | null = null;
let userChanged: (id: string | null) => void = () => {};
mock.module("./account.ts", {
  namedExports: {
    supabase: () => ({ from: (name: string) => (name === "bank_saved" ? savedTable() : attemptTable()) }),
    onUser: (cb: (id: string | null) => void) => { userChanged = cb; cb(signedIn); return () => {}; },
  },
});
(globalThis as { window?: unknown }).window = { addEventListener() {}, removeEventListener() {} };

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const signIn = async (id: string | null) => { signedIn = id; userChanged(id); await settle(); };
const row = (user: string, part: string, bookmarked: boolean, note: string, at: number): Row =>
  ({ user_id: user, part_id: part, subject: "maths", bookmarked, note, updated_at: new Date(at).toISOString() });

test("saved questions follow a student, and stay theirs", async t => {
  const { startSync } = await import("./bankSync");
  const { saveNote, savedItems, savedOwner, setBookmarks, mergeSaved } = await import("./bankSaved");
  startSync();

  await t.test("with the table not there yet, sync stays quiet and nothing here is lost", async () => {
    const warn = mock.method(console, "warn", () => {});
    missingTable = true;
    setBookmarks("maths", ["early"], true);
    await signIn("ana");
    await signIn(null);
    assert.equal(savedItems().early?.b, true);
    assert.equal(savedOwner(), null);
    missingTable = false;
    warn.mock.restore();
  });

  await t.test("signing in brings the account's down and sends what the account lacks or has older", async () => {
    mergeSaved([
      { part: "older-here", entry: { s: "maths", b: true, n: "", at: 1_000 } },
      { part: "newer-here", entry: { s: "maths", b: true, n: "mine", at: 5_000 } },
    ]);
    db.set("ana|older-here", row("ana", "older-here", false, "", 2_000)); // taken off on the iPad's browser
    db.set("ana|newer-here", row("ana", "newer-here", true, "old", 1_000));
    db.set("ana|only-there", row("ana", "only-there", true, "from the other device", 3_000));
    await signIn("ana");
    const items = savedItems();
    assert.equal(items["older-here"].b, false, "a bookmark taken off elsewhere stays off");
    assert.equal(items["only-there"].n, "from the other device");
    assert.equal(db.get("ana|newer-here")?.note, "mine");
    assert.deepEqual(upserts.flat().map(r => r.part_id).sort(), ["early", "newer-here"]);
    assert.equal(savedOwner(), "ana");
  });

  await t.test("changes go up together, once typing and tapping have stopped", async () => {
    upserts.length = 0;
    setBookmarks("maths", ["q1", "q2"], true);
    saveNote("maths", "q1", "first go");
    saveNote("maths", "q1", "second go");
    assert.equal(upserts.length, 0);
    await settle(1_600);
    assert.equal(upserts.length, 1);
    assert.deepEqual(upserts[0].map(r => r.part_id).sort(), ["q1", "q2"]);
    assert.equal(db.get("ana|q1")?.note, "second go");
  });

  await t.test("taking a bookmark off reaches the account, so other devices learn of it", async () => {
    setBookmarks("maths", ["q2"], false);
    await settle(1_600);
    assert.equal(db.get("ana|q2")?.bookmarked, false);
  });

  await t.test("signing out takes the copy off this browser, and signing back in restores it", async () => {
    await signIn(null);
    assert.deepEqual(savedItems(), {});
    await signIn("ana");
    assert.equal(savedItems().q1.n, "second go");
  });

  await t.test("the next student to sign in gets none of it, and sends none of it", async () => {
    upserts.length = 0;
    await signIn("ben");
    assert.deepEqual(savedItems(), {});
    assert.equal(upserts.flat().length, 0);
    assert.equal([...db.values()].filter(r => r.user_id === "ben").length, 0);
    assert.equal(savedOwner(), "ben");
  });
});
