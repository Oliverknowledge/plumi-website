import type { LobbyPerson } from "@/lib/social/lobby";

/**
 * What a student is on, said only when it is known.
 *
 * The server does not record a platform (nothing in migrations 0104 to 0123 does), so none is claimed that is not
 * proved. What is proved: the person keys of an avatar (`outfit`, `hair`, `body`...) are written only by the
 * iPad's wardrobe, so a student who has them plays on iPad. A student without them might be on the web, on an iPad
 * that has not been updated, or one who never dressed their person: nothing is said. If a later migration lets the
 * avatar carry `plat` ("ipad" or "web"), it is read here first.
 */
export type Platform = "iPad" | "Web";

export function platformOf(p: Pick<LobbyPerson, "avatar">): Platform | null {
  const a = p.avatar;
  if (!a) return null;
  if (a.plat === "ipad") return "iPad";
  if (a.plat === "web") return "Web";
  return a.outfit !== undefined || a.hair !== undefined || a.body !== undefined ? "iPad" : null;
}
