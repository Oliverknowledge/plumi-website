<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working in this repo

Daniel, Oliver, Claude Code and Codex all work here at once, often on several tasks each. These rules keep that safe and cheap.

## Before you start

- Open your tool in the repo, not a folder above it, or it won't load this file.
- Check nobody has it already: `gh pr list`, and `npm run bank:status -- <words>` for a question bank.
- Starting a big task? Open a draft PR early. That's how others see it's taken.
- Adding a question bank: follow `docs/question-bank/add-a-bank.md`.

## One task, one worktree, one branch

- Every task gets its own worktree on its own branch off `origin/main`: `claude/<task>` or `codex/<task>`. Don't switch branches in the main clone or work in another task's worktree.
- Claude Code's app makes the worktree when its Worktree toggle is on. Otherwise:

  ```bash
  git fetch origin
  git worktree add ../plumi-website-<task> -b codex/<task> origin/main
  cp ../plumi-website/.env.local ../plumi-website-<task>/
  cd ../plumi-website-<task> && npm ci
  ```

- Keep checkouts out of `~/Desktop` and `~/Documents`. iCloud syncs them, and it has evicted git's files and hung git commands.
- When you've verified your work, delete the worktree's `.next` (about 2.8 GB). A filled disk has failed parallel builds.

## Getting to main

- Everything reaches `main` through a PR. Don't push to `main`.
- Don't merge unless a person asks you to, and then use "Create a merge commit".
- Merging to `main` doesn't deploy, so it costs nothing. The live site follows the `production` branch.
- `npm run deploy` is a production build of 5 to 9 minutes on a shared bill, so don't run it unless a person asks. `npm run deploy:pending` shows what would go out. See `docs/DEPLOY.md`.
- Merged isn't live: check a change on the live site only after it has deployed.
- `claude/**` branches get no Vercel previews, so test them with `next build` locally. Pushing to them costs no build.

## Checks

CI runs lint, typecheck and `bank:status -- --check` on every PR. Before pushing, run those plus the tests for what you touched:

| Area | Command |
| --- | --- |
| Study app | `npm run app:test` |
| Sharing | `npm run sharing:test` |
| Library | `npm run library:test` |
| Social | `npm run social:verify` |
| Calculator | `npm run calculator:test` |
| Question PDFs | `npm run pdf:test` |
| Dark questions | `npm run dark:test` |
| Saved questions | `npm run saved:test` |
| A question bank | `npm run bank:check -- <slug>` |

Passing checks don't prove a page works. Look at UI changes in a browser, and watch the console: when a bank's data fails to load, the heading and a built-in sample still look right.

## Files that collide

- **Migrations:** files in `supabase/migrations` are numbered, so only one task adds one at a time. Renumber before merging if another landed first.
- **Dependencies:** don't add or upgrade any unless the task says so. Use npm: `package-lock.json` is the lockfile to change. `next` can rewrite `yarn.lock` locally, so don't commit that.
- **Global styles:** take care with `src/app/globals.css` and `src/app/layout.tsx`, which reach every page.
- **Bank registration:** there is none to collide on. A bank's meta in `src/content/questionBank/` registers it, and its notes go in its own files. Don't edit `questionBank.ts`, `routes.ts`, `tag.md` or `docs/seo/question-bank.md` for a bank. If `questionBank.generated.ts` is missing or a new bank doesn't show, run `npm run bank:registry`.

## Question bank files

- Papers come from the boards' own public websites. Using a third-party mirror is Daniel's call, each time, for each subject.
- Crops and bank data live on R2, not in git. Crops are cached for a year as immutable, so never replace an image under a published name without a new `cropVersion`.
- Do bulk reads through the S3 API. The public `r2.dev` address is rate limited, and students use it.
- Re-cutting a live bank has its own traps: see `docs/question-bank/add-a-bank.md`.
