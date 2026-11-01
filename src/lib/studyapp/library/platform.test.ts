import assert from "node:assert/strict";
import { test } from "node:test";
import { platformOf } from "./platform";

test("a student with the wardrobe's person keys is on iPad", () => {
  assert.equal(platformOf({ avatar: { body: "03", eyes: "01", outfit: "12", hair: "40", acc: "none", phones: "red" } }), "iPad");
  assert.equal(platformOf({ avatar: { hair: "40" } }), "iPad");
});
test("nothing is claimed without proof: no avatar, or only the old keys", () => {
  assert.equal(platformOf({ avatar: null }), null);
  assert.equal(platformOf({ avatar: {} }), null);
  assert.equal(platformOf({ avatar: { top: "hoodie", colour: "#e0605a", hat: "none", glasses: "none" } }), null);
});
test("an explicit platform key wins, if the server ever carries one", () => {
  assert.equal(platformOf({ avatar: { plat: "web" } }), "Web");
  assert.equal(platformOf({ avatar: { plat: "ipad", outfit: "01" } }), "iPad");
});
