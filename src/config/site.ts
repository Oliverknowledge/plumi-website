export type LaunchMode = "community" | "waitlist" | "appStore";
export const launchMode: LaunchMode = "community";
export const appStoreUrl: string | null = null;
export const discordUrl = "https://discord.com/invite/mPhTczwfpk";
// Midnight in Britain on the confirmed launch date (BST, UTC+1).
export const launchDate = "2026-09-25T00:00:00+01:00";
export const site = {
  name: "Plumi",
  domain: "https://tryplumi.app",
  alternateDomain: "https://plumi.study",
  tagline: "Your notebook. Now your tutor.",
  description: "The iPad notebook that tutors you on the page, then builds practice around what your work reveals.",
  contactEmail: "hello@tryplumi.app",
  locale: "en_GB",
} as const;
export const cta = {
  community: { primary: "Join the Discord community", compact: "Join Discord", supporting: "Made for iPad. Built around you.", reassurance: "Launching 25 September 2026" },
  waitlist: { primary: "Join the Discord community", compact: "Join Discord", supporting: "Made for iPad. Built around you.", reassurance: "Launching 25 September 2026" },
  appStore: { primary: "Download on the App Store", compact: "Download", supporting: "Free to write in. iPad and Apple Pencil.", reassurance: "Requires iPadOS 17 or later." },
} as const;
export const activeCta = cta[launchMode];
export function isWaitlistMode(): boolean { return false; }
export function assertLaunchConfig(): void {
  if (launchMode === "appStore" && (!appStoreUrl || !appStoreUrl.startsWith("https://apps.apple.com/"))) {
    throw new Error("Set a verified App Store URL before switching launchMode to appStore.");
  }
}
export function primaryCtaHref(): string { return launchMode === "appStore" ? appStoreUrl! : discordUrl; }
