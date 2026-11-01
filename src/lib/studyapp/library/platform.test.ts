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
test("what the server says wins over the avatar, whichever way they disagree", () => {
  const wardrobe = { body: "03", outfit: "12", hair: "40" };
  assert.equal(platformOf({ avatar: wardrobe, platform: "web" }), "Web", "dressed on an iPad, but on the web right now");
  assert.equal(platformOf({ avatar: null, platform: "ipad" }), "iPad");
  assert.equal(platformOf({ avatar: { plat: "web" }, platform: "ipad" }), "iPad");
});
test("a platform the server did not say, or one off the list, falls back to the old reading", () => {
  const wardrobe = { body: "03", outfit: "12" };
  assert.equal(platformOf({ avatar: wardrobe, platform: null }), "iPad");
  assert.equal(platformOf({ avatar: wardrobe, platform: undefined }), "iPad");
  assert.equal(platformOf({ avatar: wardrobe, platform: "android" as never }), "iPad");
  assert.equal(platformOf({ avatar: null, platform: "android" as never }), null);
  assert.equal(platformOf({ avatar: { top: "hoodie" }, platform: null }), null);
});
test("a fox is not proof of an iPad: the website writes body \"fox\", the iPad cannot", () => {
  assert.equal(platformOf({ avatar: { body: "fox" } }), null);
  assert.equal(platformOf({ avatar: { body: "fox", eyes: "02", outfit: "10_01", hair: "05_01", acc: "none", phones: "teal" } }), null, "the person keys it kept are not proof either");
  assert.equal(platformOf({ avatar: { body: "03" } }), "iPad", "a skin still is");
  assert.equal(platformOf({ avatar: { body: "fox" }, platform: "web" }), "Web", "what the server says still wins");
  assert.equal(platformOf({ avatar: { body: "fox" }, platform: "ipad" }), "iPad");
  assert.equal(platformOf({ avatar: { body: "fox", plat: "web" } }), "Web");
});
