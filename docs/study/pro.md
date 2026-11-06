# Plumi Pro on the website

Pro is bought **only in the Plumi app on iPad**. The website only **reads** the student's entitlement. There is no purchase link, no price and no "cheaper on the web" wording anywhere (Apple's steering rules); the locked panel says "Pro is bought in the Plumi app on iPad, then it works here when you sign in" and nothing more.

## End to end

1. A student buys Pro in the iPad app. The app sends Apple's signed transaction to the `entitlement-sync` Edge Function, which writes the account's row in `account_entitlements` (migration 0127).
2. The website sends the signed-in student's Supabase access token to its own server: `GET /api/pro-status`, or any Pro route.
3. The server (`src/lib/pro/server.ts`) asks Supabase who the token is (`/auth/v1/user`), then reads **that user's own row** with the **caller's own token** (row-level security allows only own rows). It does **not** call `account_pro`: that function records the caller as one of the account's three devices, and the website must never take a slot.
4. The rule is `account_pro_live`: `active` grants while `expires_at` is in the future; `grace` while `expires_at` is less than two days ago; `expired`, `revoked`, no row, or an anonymous user never grant. (The three-device limit is the one thing left out, on purpose; the server's clock is used, not the database's.)
5. The screen (`usePro()`) shows locks, tags and the Settings plan from the answer. **The screen is a courtesy. Every Pro route checks again on the server** (`requirePro`), so a student who edits the page in their browser gets a lock that opens onto nothing.

## The layer

| Piece | Where |
| --- | --- |
| Server: `getProState(req)` gives `{state, reason, expiresAt?, status?}`; `requirePro(req)` is the first line of a Pro route; 30 s cache by a hash of the token; 4 s Supabase timeout; same-origin only; light rate limit; nothing logged | `src/lib/pro/server.ts` |
| Client hook `usePro()` gives `{state, loading, plan, refresh, ready}`; one shared request | `src/lib/pro/client.ts` |
| The list of Pro features (id, title, one line, live or soon) | `src/lib/pro/features.ts` |
| What Settings says about the plan | `src/lib/pro/plan.ts` |
| The test seam | `src/lib/pro/override.ts` |
| `ProTag`, `ProLockedPanel`, `ProGate` and `useProLock`, `ProPlanSection` | `src/components/pro/` |
| Routes | `src/app/api/pro-status/route.ts`, `src/app/api/premade/markscheme/[spec]/route.ts` |

### The states

| `state` | Meaning | On screen |
| --- | --- | --- |
| `unknown` | The answer is on its way, or could not be had (Supabase slow or down, an error) | Neutral: no lock, no tag. Never "free". Asked again after 60 s |
| `free` | Signed out, anonymous, no record, expired, revoked | Locked tiles, the panel on a tap, "Free plan" in Settings |
| `pro` | A live record | Open. "You have Plumi Pro", "Active until 14 Dec" from `expires_at`. We never say it renews |

Signed out is `free` at once (no flash). The answer is kept for the visit; it is asked again when the tab comes back after 5 minutes or more (the old answer stays on screen until the new one lands) and after signing in or out. Settings "Check again" asks again past every cache (`?fresh=1`, which also skips the server's 30 s cache), for the minute after a purchase on iPad.

### HTTP

`GET /api/pro-status`: 200 `{pro, expiresAt, status}`; 403 `{error: "pro", reason, expiresAt?}` (reason: none, expired, revoked, anonymous); 401 no or unaccepted token; 429; 503 not told. Routes that ship content answer 403 (not Pro), 401, 429, 503 (Supabase could not be asked in time: try again, never "free"), 403 `origin` for another origin. `Cache-Control: private, no-store`. No CORS header is ever sent.

## Add a Pro feature in five steps

1. **Add it to `src/lib/pro/features.ts`**: a stable kebab-case `id` (never renamed: it is the analytics id), a `title`, one short `line`, `status: "live"` (or `"soon"`). It then appears in Settings.
2. **Wrap it in `ProGate`** (`<ProGate feature="my-feature" fallback={<LockedThing/>}>...</ProGate>`; a neutral `pending` shows while unknown). In a fallback or a tile, `const lock = useProLock("my-feature")`: `lock.tap()` records `pro_locked_tapped` and opens the panel; render `lock.panel` once. Use `ProTag` for the pill.
3. **Enforce it on the server if it ships content or costs money**: start the route handler with `const guard = await requirePro(req); if (!guard.ok) return guard.response;`. Keep Pro content out of the client bundle (see the mark scheme decks: `src/content/proDecks`, a `server-only` loader, `npm run decks:leak-check`).
4. **Analytics**: the events are already declared (`pro_locked_tapped`, `pro_panel_opened`, `pro_status_checked`); pass your `id` as `feature`. No ids or emails.
5. **Add a test**: a pure test for the new rule, and for a route a test with a mocked Supabase like `src/lib/pro/server.test.ts`.

## Seeing the website as Pro without a purchase (test seam)

In a build that is **not production** (`next dev`, tests) add `?pro=on` or `?pro=off` to the URL, or set `localStorage["plumi-pro-override"]` to `on` or `off` (`?pro=clear` removes it). It changes what the screen shows. **It does not bypass the server**: a free account that sees "Pro" gets the locked panel when it asks for content (the server says 403). In a production build it does nothing at all: `readProOverride` refuses and the hook never reads the URL or storage (tested).

## Checks

```bash
npm run app:test                      # includes src/lib/pro/*.test.ts
npm run build && npm run decks:leak-check   # the mark scheme card text is absent from the static output
```

## Verifying with a real Sandbox account (once the iPad build with account Pro ships)

1. Sign in on the iPad with a Plumi account and buy Pro in the App Store Sandbox. Check the `account_entitlements` row appears for that account (`status = 'active'`, `expires_at` ahead).
2. On the website, sign in to the **same** account. Settings, "Plumi Pro": "You have Plumi Pro", "Active until <date>". Flashcards, Ready-made decks, Mark scheme: a plus on each deck; tapping adds one.
3. Signed out, or with a free account: locked tiles, the panel, "Free plan". `curl -i https://<site>/api/premade/markscheme/aqa-7402` is 401; with a free account's token it is 403.
4. Right after buying: Settings, "Check again" turns "Free plan" into "You have Plumi Pro" without a reload.

## Three prerequisites (none is done by this code)

1. **Migration 0127 is applied** to the Supabase project (`account_entitlements`, `account_pro`, the Edge Functions deployed).
2. **The public Supabase variables are set on the Vercel Production environment**: `NEXT_PUBLIC_PLUMI_SUPABASE_URL` and `NEXT_PUBLIC_PLUMI_SUPABASE_KEY` (the Pro routes read the same two the browser uses). Without them every answer is "unknown" and nothing is ever locked or opened wrongly; Pro content stays closed.
3. **The iPad build that releases the client half ships** (the part that sends the transaction to `entitlement-sync`), or no account will ever hold a record.

A Pro student keeps what they added: a mark scheme deck copied to their flashcards stays if Pro lapses; they simply cannot add more.
