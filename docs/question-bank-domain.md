# Moving the question bank's files to a custom domain

Plan written 4 November 2026. **Nothing here has been done yet**: every dashboard step is the founder's.

## Why

Students load every crop, PDF and bank data file from `pub-e8a9….r2.dev`. Cloudflare says that address is
"not intended for production usage" and has "a variable rate limit" ([limits](https://developers.cloudflare.com/r2/platform/limits/)).
An audit got 429s at about 45 requests a second from one machine. It also has no cache
([public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)), so every view of every crop is a read from the bucket.
A custom domain gets Cloudflare's cache, and Cloudflare publishes no such rate limit for one.

## The decision: which domain

An R2 custom domain must be on a Cloudflare zone in the bucket's account. **Both our domains' DNS is on Vercel**, so
`papers.tryplumi.app` can't simply be added. Keeping DNS on Vercel isn't an option at our size: a CNAME setup needs
Cloudflare's [Business plan](https://developers.cloudflare.com/dns/zone-setups/partial-setup/) and a subdomain zone needs
[Enterprise](https://developers.cloudflare.com/dns/zone-setups/subdomain-setup/).

| | Move needed | If a record is missed | |
|---|---|---|---|
| **`papers.plumi.study`** | plumi.study's DNS to Cloudflare Free | The redirect to tryplumi.app stops. No site, no mail. | **Recommended** |
| `papers.tryplumi.app` | tryplumi.app's DNS to Cloudflare Free | The site, Google Workspace mail or Resend sending | Nicer name, real risk |
| A new domain | Buy one, on Cloudflare | Nothing | Costs a yearly fee, one more domain to keep |

plumi.study only 308-redirects to tryplumi.app, and public lookups found no MX, SPF, DKIM or DMARC records on it.
tryplumi.app has MX, SPF, DKIM and two Google verifications. Students barely see this name: only when a PDF opens in a tab.
If the Cloudflare account already has another domain on it, that works too and needs no DNS move.

The steps below use `papers.plumi.study`.

## Founder's steps

**Cloudflare and DNS**

1. Cloudflare: add `plumi.study` on the Free plan. Keep the apex and `www` records, pointing at the values Vercel's domain
   page gives, set to **DNS only** (grey cloud), so Vercel keeps serving the redirect.
2. Change plumi.study's nameservers to the two Cloudflare gives. The domain is registered through Name.com, which Vercel also
   resells, so the setting is on Vercel's Domains page if it was bought there, otherwise on Name.com. Then check
   `https://plumi.study/privacy` still redirects.
3. R2 > `plumipapers` > Settings > Custom Domains > add `papers.plumi.study`, and wait for Active. **Leave r2.dev enabled.**
4. Caching > Tiered Cache: turn on Smart Tiered Cache, which [Cloudflare recommends for R2](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/).
5. Caching > Cache Rules: hostname equals `papers.plumi.study` and URI path starts with `/bank-data/`: eligible for cache, Edge TTL
   "use cache-control header". JSON [isn't cached by default](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/);
   images, PDFs and audio are. Those data files are named by their hash, so they can't go stale.
6. Leave Bot Fight Mode and Hotlink Protection off: Vercel's builds and Discord's image proxy have to get through.

**Check it (Claude can do this and step 9)**

7. `python3 scripts/question-bank/check_papers_host.py https://papers.plumi.study`. It must print "Ready." before going on. It
   proves the bytes match r2.dev, the cache hits, and CORS is right for both tryplumi.app and study.tryplumi.app from the cache.

**Vercel**

8. Settings > Environment Variables: set `NEXT_PUBLIC_PAPERS_URL` to `https://papers.plumi.study` for Production and Preview.
   It's compiled in, so it takes effect at the next production build. Set it just before the next `npm run deploy` and it costs no
   extra build. That build fetches about 137 banks' lists afresh, as their addresses change.

**Afterwards**

9. Open a question feed on tryplumi.app and study.tryplumi.app, and check crops load from the new address with no console errors on `bank-data` files.
10. Discord bot: add `PLUMI_PAPERS_URL=https://papers.plumi.study` to `discord-bot/.env` and run `deploy/push.sh 145.241.231.223`,
    which copies it to the server and restarts the bot. It's a separate variable because the bot isn't built by Vercel, and until then it keeps working on r2.dev.

**To undo:** in Vercel, promote the previous deployment, which is instant, and set the variable back so the next build keeps it.

## What must stay true

- **Keep r2.dev enabled.** Open tabs, older deployments and Discord posts already sent still ask for it. Only turn it off if
  WAF or Access rules are ever added to the new domain, since they don't apply on r2.dev.
- **Don't set the variable to `papers.tryplumi.app`**, as `upload_r2.py` used to suggest. Vercel's wildcard answers that name with a
  404, so every crop would break and the build would fail.
- **Don't CNAME to r2.dev**: Cloudflare calls that an [unsupported access path](https://developers.cloudflare.com/r2/buckets/public-buckets/).
- **Don't make the cache ignore query strings.** `?v=` is how a re-cut reaches people.

## What changes for bank work

**A re-cut must bump the bank's `cropVersion`.** Crops are sent with a year-long immutable cache. Today, a crop overwritten under the
same name without a bump still reaches new visitors, because r2.dev has no cache. On the new domain Cloudflare would keep serving
the old crop to everyone. If a bump is missed, purge that URL, once for each `?v=` it's asked with
([purge by URL](https://developers.cloudflare.com/cache/how-to/purge-cache/) is on the Free plan).

Bulk work still goes through the S3 API. Sessions' `.env.local` files can stay on r2.dev until they next need the new address.

If CORS fails in step 7 (Cloudflare's cache key [includes the Origin header](https://developers.cloudflare.com/cache/how-to/cache-keys/), so it shouldn't),
add a Response Header Transform Rule setting `Access-Control-Allow-Origin: *` on the hostname, and purge the hostname.

Once the new domain has run for a while, `PACE` in `src/lib/questionSetPdf.ts`, which is throttled for r2.dev's limit, could be loosened so big PDFs build faster.
