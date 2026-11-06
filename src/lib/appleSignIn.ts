/**
 * "Continue with Apple" on the website is behind a switch, off unless NEXT_PUBLIC_APPLE_SIGNIN is exactly "on".
 *
 * The button needs three things outside this repo before it can work: Apple's Services ID, a key, and the Apple provider
 * switched on in Supabase (docs/study/sign-in-with-apple.md). Shipping the button before they exist would give every
 * student a button that fails, so the code ships first and this flips last. It is a build-time value: Next inlines it into
 * the browser bundle, so changing it on Vercel takes a new deployment to show.
 *
 * Its own file, with no imports, so the privacy policy (a server page) and the sign-in form can both read it.
 */
export const appleSignInOn = process.env.NEXT_PUBLIC_APPLE_SIGNIN === "on";
