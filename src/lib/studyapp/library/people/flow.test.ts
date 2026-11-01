/**
 * npm run library:test
 *
 * From a save to a friend's room: set_avatar through the scripted server, the list the friend reads, the remotes the
 * room is told (with the avatar and colour to draw them from), and the line a failed save gives.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { composeRemotes } from "../compose";
import { FakeLibraryWorld } from "../fake";
import { LIBRARY_TILE } from "../room";
import { personOf, type PeopleCatalogue } from "./look";
import { itemsIn, mergeAvatar, saveLine, worn } from "./wardrobe";

const cat = JSON.parse(readFileSync(new URL("../../../../../public/library/people-layers.json", import.meta.url), "utf8")) as PeopleCatalogue;
const [A, B] = ["00000000-0000-4000-8000-00000000000a", "00000000-0000-4000-8000-00000000000b"];

function world() {
  const w = new FakeLibraryWorld();
  w.add(A, { nickname: "Quiet Otter", display: "Alex", colour: 3, avatar: { body: "03", eyes: "02", outfit: "24_02", hair: "17_05", acc: "none", phones: "lilac", pro: "1", top: "hoodie" } });
  w.add(B, { nickname: "Bold Fox", display: "Bea", colour: 5 });
  w.befriend(A, B);
  return w;
}

describe("a saved outfit reaches a friend", () => {
  it("is in the next lobby_people they read, and the room is told to draw them from it", async () => {
    const w = world();
    const alex = w.social(A), bea = w.social(B);
    const ja = await alex.joinLobby(LIBRARY_TILE), jb = await bea.joinLobby(LIBRARY_TILE, ja.ok ? ja.value.shard : null);
    assert.ok(ja.ok && jb.ok);
    const shard = ja.ok ? ja.value.shard! : 0;
    const read = async () => { const r = await bea.lobbyPeople(shard); assert.ok(r.ok); return r.ok ? r.value : []; };
    const ipad = (await read()).find((p) => p.id === A)!.avatar!;
    const draft = worn(cat, personOf(cat, ipad, 3, A), itemsIn("outfit").find((i) => i.value === "10")!);
    const merged = mergeAvatar(ipad, draft);
    assert.deepEqual(await alex.setAvatar(merged), { ok: true, value: undefined });
    const seen = (await read()).find((p) => p.id === A)!;
    assert.deepEqual(seen.avatar, merged);
    assert.equal(seen.pro, true, "the Pro nametag survives the save");
    const [remote] = composeRemotes([seen], new Map(), new Map(), 0);
    assert.deepEqual(remote.avatar, merged);
    assert.equal(remote.colour, 3);
    assert.equal(personOf(cat, remote.avatar, remote.colour, remote.id).outfit.slice(0, 2), "10");
    assert.equal(personOf(cat, remote.avatar, remote.colour, remote.id).hair, "17_05", "the hair dressed on iPad is kept");
  });

  it("is refused for an invented key, like the real function, and a failed save says one plain line", async () => {
    const w = world();
    const alex = w.social(A);
    assert.equal((await alex.setAvatar({ body: "02", sneaky: "x" })).ok, false);
    w.failing.add("setAvatar");
    const r = await alex.setAvatar({ body: "02" });
    assert.ok(!r.ok);
    if (!r.ok) {
      const line = saveLine(r.failure);
      assert.equal(line, "No connection. Try again in a moment");
      assert.doesNotMatch(line, /\u2014|_|error|set_avatar/i);
    }
    assert.equal(saveLine({ kind: "unavailable" }), "That didn’t save. Try again in a moment");
    assert.equal(w.students.get(A)!.avatar!.hair, "17_05", "nothing was saved");
  });
});
