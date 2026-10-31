export const THEME_KEY = "plumi-theme";

/** The page's paper in each theme: also the colour a phone gives its browser bar (the `theme-color` meta). */
export const THEME_COLOR = { light: "#f6efe1", dark: "#1f1a18" } as const;

/** Runs in <head>, before first paint: the saved choice, else the device's own setting. The `theme-color` meta comes before it,
 * so a dark page gets a dark browser bar from the start. (A client-side page change can add a second copy after it; the
 * browser goes by the first.) */
export const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;document.querySelectorAll('meta[name="theme-color"]:not([media])').forEach(function(m){m.content=t==="dark"?"${THEME_COLOR.dark}":"${THEME_COLOR.light}"})}catch(e){}`;
