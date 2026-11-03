import "server-only";

import { bankDataUrl, type BankPart, type BankSubject } from "@/content/questionBank";

/**
 * A bank's whole parts list, read on the server from the same file on R2 the browser fetches (bankDataUrl):
 * the topic pages at build time, the partner embed when a topic is first asked for. Each list is fetched once
 * per process, and `force-cache` keeps it in the build's data cache, so the build's workers share it; the
 * URL carries the file's hash, so nothing cached can go stale.
 */
const lists = new Map<string, Promise<BankPart[]>>();

export function bankParts(s: BankSubject): Promise<BankPart[]> {
  const url = bankDataUrl(s, "parts");
  if (!url?.startsWith("http")) {
    throw new Error(`No parts list for ${s.slug}: ${url ? "NEXT_PUBLIC_PAPERS_URL must be R2's address" : "run scripts/question-bank/upload_data.py " + s.slug}`);
  }
  let list = lists.get(url);
  if (!list) {
    list = fetch(url, { cache: "force-cache" }).then(r => {
      if (!r.ok) throw new Error(`${url} answered ${r.status}: run scripts/question-bank/upload_data.py ${s.slug}`);
      return r.json() as Promise<BankPart[]>;
    });
    list.catch(() => lists.delete(url));   // a failed fetch at request time is tried again next time
    lists.set(url, list);
  }
  return list;
}
