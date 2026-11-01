import type { LobbyPerson } from "@/lib/social/lobby";
import { PLATFORM_TITLE, platformOfRow } from "@/lib/social/lobby";

/**
 * What a student is on, said only when it is known.
 *
 * FIRST, WHAT THE SERVER SAYS. Since migration 0124 each library visit states the device it is on now (`ipad` or `web`)
 * and `lobby_people` returns it, so the website reports `web` itself and an updated iPad reports `ipad`. That is the
 * device they are on right now, so it wins over everything below. It is self-reported, a courtesy label and not a proof.
 *
 * ONLY WHEN THE SERVER SAYS NOTHING (an iPad build from before 0124, or a project that has not had it), the old inference
 * stands: the person keys of an avatar (`outfit`, `hair`, `body`...) are written only by the iPad's wardrobe, so a student
 * who has them plays on iPad. A student without them might be on the web, on an iPad that has not been updated, or one
 * who never dressed their person: nothing is said. A `plat` key in the avatar ("ipad" or "web"), if one ever exists, is
 * read before the wardrobe keys.
 */
export type Platform = "iPad" | "Web";

export function platformOf(p: Pick<LobbyPerson, "avatar"> & Partial<Pick<LobbyPerson, "platform">>): Platform | null {
  const served = platformOfRow(p.platform);
  if (served) return PLATFORM_TITLE[served];
  const a = p.avatar;
  if (!a) return null;
  if (a.plat === "ipad") return "iPad";
  if (a.plat === "web") return "Web";
  return a.outfit !== undefined || a.hair !== undefined || a.body !== undefined ? "iPad" : null;
}
