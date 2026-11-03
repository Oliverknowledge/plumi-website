import "server-only";

import { bankDataUrl, type BankPart, type BankSubject } from "@/content/questionBank";

/**
 * A bank's whole parts list, read on the server from the same file on R2 the browser fetches (bankDataUrl):
 * the topic pages at build time, the partner embed when a topic is first asked for. Each list is fetched once
 * per process, and `force-cache` keeps it in the build's data cache, so the build's workers share it; the
 * URL carries the file's hash, so nothing cached can go stale.
 */
const lists = new Map<string, Promise<BankPart[]>>();

/** r2.dev rate-limits bursts, and a build's workers all ask at once, so a refusal or a dropped connection is tried again before it can stop the build. */
async function fetchParts(url: string, slug: string, tries = 4): Promise<BankPart[]> {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { cache: "force-cache" });
      if (r.ok) return (await r.json()) as BankPart[];
      if (r.status < 429 || i >= tries) throw new Error(`${url} answered ${r.status}: run scripts/question-bank/upload_data.py ${slug}`);
    } catch (e) {
      if (i >= tries || (e instanceof Error && e.message.includes("upload_data.py"))) throw e;
    }
    await new Promise(done => setTimeout(done, 500 * 2 ** i));
  }
}

export function bankParts(s: BankSubject): Promise<BankPart[]> {
  const url = bankDataUrl(s, "parts");
  if (!url?.startsWith("http")) {
    throw new Error(`No parts list for ${s.slug}: ${url ? "NEXT_PUBLIC_PAPERS_URL must be R2's address" : "run scripts/question-bank/upload_data.py " + s.slug}`);
  }
  let list = lists.get(url);
  if (!list) {
    list = fetchParts(url, s.slug);
    list.catch(() => lists.delete(url));   // a failed fetch at request time is tried again next time
    lists.set(url, list);
  }
  return list;
}
