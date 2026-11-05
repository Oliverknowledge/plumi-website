/**
 * Where the question bank's files are served from: NEXT_PUBLIC_PAPERS_URL if set, otherwise (in any built site, a Vercel
 * preview included) the bucket's r2.dev address, so a preview deployment without the variable still shows the pictures;
 * `next dev` keeps /papers-local. To move the files to another address, change the variable and build: every page, redirect
 * and link is made from `papersBase`. docs/question-bank-domain.md has the move itself.
 *
 * The r2.dev address has to keep answering after a move: open tabs, older deployments and Discord posts still ask for it.
 */
export const R2_DEV_URL = "https://pub-e8a9dbab8e2a4d089f52b2a45e0d0b50.r2.dev";

export const resolvePapersBase = (url: string | undefined, nodeEnv: string | undefined) =>
  (url ?? (nodeEnv === "production" ? R2_DEV_URL : "/papers-local")).replace(/\/$/, "");

export const papersBase = resolvePapersBase(process.env.NEXT_PUBLIC_PAPERS_URL, process.env.NODE_ENV);
