import { THEME_COLOR, THEME_KEY } from "@/lib/theme";
import type { Look } from "./tokens";

/**
 * The look is `data-look` on <html>, the same place the site keeps `data-theme`, so one
 * attribute pair drives the whole palette. Blue is the app's main look and the default: no
 * attribute means blue.
 *
 * Dark mode is the site's own (src/lib/theme.ts): the root layout sets `data-theme` before
 * first paint from the saved choice, else the device. The study app reuses it rather than
 * keeping a second switch, so a student who chose dark on tryplumi.app has it here too
 * (same origin family, but localStorage is per host: the choice is made again once on the
 * subdomain; see the doc).
 */
export const LOOK_KEY = "plumi-look";

/** Runs before first paint. Anything but a known look is ignored. */
export const lookScript = `try{var l=localStorage.getItem("${LOOK_KEY}");if(l==="lime"||l==="blue")document.documentElement.dataset.look=l}catch(e){}`;

export function readLook(): Look {
  return document.documentElement.dataset.look === "lime" ? "lime" : "blue";
}

export function writeLook(look: Look) {
  document.documentElement.dataset.look = look;
  try { localStorage.setItem(LOOK_KEY, look); } catch { /* private mode: lasts until the tab closes */ }
}

export function readDark(): boolean {
  return document.documentElement.dataset.theme === "dark";
}

export function writeDark(dark: boolean) {
  const next = dark ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  document.querySelectorAll('meta[name="theme-color"]:not([media])').forEach((m) => m.setAttribute("content", THEME_COLOR[next]));
  try { localStorage.setItem(THEME_KEY, next); } catch { /* as above */ }
}

/** Re-render when either attribute changes, whoever changed it. */
export function subscribeAppearance(changed: () => void) {
  const watch = new MutationObserver(changed);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-look", "data-theme"] });
  return () => watch.disconnect();
}
