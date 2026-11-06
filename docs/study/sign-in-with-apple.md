# Sign in with Apple on the website

"Continue with Apple" sits beside "Continue with Google" on `/sign-in` and `/sign-up` (the email-code view too). The iPad app already has native Sign in with Apple; this is the web flow, and it signs the same person into the same Supabase account.

The code ships **off**. It shows nothing until `NEXT_PUBLIC_APPLE_SIGNIN` is `on`, so nothing broken reaches students before the setup below is finished.

## How it flows

1. The button calls `signInWithApple` (`src/lib/account.ts`), which calls Supabase's `signInWithOAuth({ provider: "apple" })` with `redirectTo = <this site>/auth/callback?next=<where they were going>`. It is the same helper as Google's, so `next` goes through the same `safeNext` check (a path on this site only) and the same PKCE exchange.
2. The browser goes to `https://asrmxkfqcrmqqdtanera.supabase.co/auth/v1/authorize?provider=apple...`, then to Apple.
3. Apple answers Supabase (a POST to the return URL below). That part is Supabase's; the site never sees it.
4. Supabase redirects to `/auth/callback` on the host the student started from (`tryplumi.app` or `study.tryplumi.app`). `src/proxy.ts` serves `/auth/callback`, `/sign-in` and `/sign-up` as they are on both hosts (`AUTH_PATHS` in `src/lib/studyapp/routing.ts`), so nothing blocks it.
5. If the student cancels at Apple, Supabase redirects to the same callback with `error` params, and `AuthCallback` shows "Signing in didn't finish" with a way back. Nothing from the provider is shown as it came.

The name: Apple sends it **only on the first sign-in**, and only if the student shares it. Supabase stores it in `user_metadata` (`full_name` or `name`). `src/lib/accountName.ts` reads it for the account menu, the app top bar and Settings, the same way as for Google, and shows the email when there is no name. The email may be Apple's private relay address (`...@privaterelay.appleid.com`) if they chose Hide My Email. Someone who signs in with Apple once without sharing a name will never be offered the name again; that is Apple's rule, not a bug.

## What is configured where

| Where | What |
| --- | --- |
| Apple Developer, Identifiers, Services ID | `dev.plumi.web`, with Sign in with Apple enabled. Domain `asrmxkfqcrmqqdtanera.supabase.co`. Return URL `https://asrmxkfqcrmqqdtanera.supabase.co/auth/v1/callback`. |
| Apple Developer, Keys | A key with Sign in with Apple enabled, for the app's primary App ID. Keep the `.p8`, the Key ID and the Team ID. |
| Supabase, Authentication, Providers, Apple | Enabled. Client ID `dev.plumi.web` (add the iPad app's bundle ID too, comma separated, if native sign-in should keep working through the same provider). Secret key: the client secret JWT made from the key (below). |
| Supabase, Authentication, URL Configuration | Redirect URLs must include `https://tryplumi.app/auth/callback**` and `https://study.tryplumi.app/auth/callback**` (already there for Google; check, and add `http://localhost:3000/auth/callback**` to test locally). |
| Vercel, Production environment | `NEXT_PUBLIC_APPLE_SIGNIN=on`. Build-time: it needs a new production deployment to show. Leave it unset in Preview and Development unless testing. |

## The client secret expires every 6 months

Apple's client secret is a JWT signed with the `.p8` key, and Apple limits it to 6 months. When it lapses, Apple sign-in on the web (not the iPad app's native sign-in) fails for everyone, with the button still showing. Put a reminder in the calendar for **5 months** after the day it is set in Supabase, make a new secret from the same key, and paste it into the Supabase Apple provider. The key itself does not expire.

## Testing

- Pure: `npm run app:test` runs `src/lib/account.apple.test.ts` (the real Supabase client with a stubbed browser: asserts the authorize address has `provider=apple`, a valid `redirect_to`, PKCE, and that a `next` leaving the site is replaced), `accountName.test.ts` and the privacy-policy tests. No network, no Apple.
- In a browser, without Apple: build with `NEXT_PUBLIC_APPLE_SIGNIN=on npm run build && npm start`, open `/sign-in`, and the button shows. Click it with the network blocked or intercepted and look at the `/auth/v1/authorize` request.
- The real thing needs the setup above. After Supabase's provider is on and the variable is flipped on a preview or locally: sign in with a real Apple ID on a laptop and on a phone, with and without Hide My Email, and check the account menu name and that `next` is honoured. Then sign in on the iPad with the same Apple ID and check it is the same account (same email, or the same Apple `sub`; a Hide My Email address differs per developer team, but the website and the app share a team).

## The privacy policy

`src/content/legal.ts`, section "The website", lists the ways in. It names Apple (and that Apple may share the name and email, or a relay address) **only when the same variable is on**, so the policy never claims a way in the site does not offer. "What we collect" and the services list already cover Sign in with Apple, the shared name and Hide My Email, because the app has had it. Flip the variable and deploy together; the policy follows from the same build.

## Switching it off

Unset or change `NEXT_PUBLIC_APPLE_SIGNIN` and redeploy. People already signed in with Apple stay signed in; their account does not change.
