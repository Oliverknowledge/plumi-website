import assert from "node:assert/strict";
import { test } from "node:test";
import { inviteUrl, parseInvite } from "../social/friendCode";

test("web invite links are on tryplumi.app and read back, as are the iPad's plumi.app ones", () => {
  assert.equal(inviteUrl("friend", "ABCD2345"), "https://tryplumi.app/f/ABCD2345");
  assert.equal(inviteUrl("group", "ABCD2345"), "https://tryplumi.app/g/ABCD2345");
  assert.deepEqual(parseInvite(inviteUrl("group", "ABCD2345")), { kind: "group", code: "ABCD2345" });
  assert.deepEqual(parseInvite("https://plumi.app/f/ABCD2345"), { kind: "friend", code: "ABCD2345" });
});
