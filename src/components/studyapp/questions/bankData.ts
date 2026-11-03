"use client";

import { useEffect, useState } from "react";
import { bankFile, subjectFile } from "@/lib/studyapp/questions/cropUrls";
import { fold, type BankRow } from "@/lib/studyapp/questions/picker";
import type { SubjectMeta } from "@/lib/studyapp/questions/subject";

/**
 * A subject's data, fetched when it is chosen and kept for the visit: its names and topics (a few KB), its parts
 * (`parts.json`, a few thousand short rows), and, only when someone searches, the papers' text (`text.json`, up to a megabyte).
 */
const metas = new Map<string, Promise<SubjectMeta>>();
const parts = new Map<string, Promise<BankRow[]>>();
const texts = new Map<string, Promise<Record<string, string>>>();

const json = <T,>(url: string): Promise<T> => fetch(url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<T>; });
const once = <T,>(m: Map<string, Promise<T>>, key: string, make: () => Promise<T>) => {
  let p = m.get(key);
  if (!p) { p = make(); m.set(key, p); p.catch(() => m.delete(key)); }
  return p;
};

export type Loaded = { state: "loading" } | { state: "error" } | { state: "ready"; meta: SubjectMeta; rows: BankRow[] };

export function useSubject(slug: string | null, attempt = 0): Loaded {
  const [got, setGot] = useState<{ slug: string; attempt: number; meta: SubjectMeta; rows: BankRow[] } | "error" | null>(null);
  useEffect(() => {
    if (!slug) return;
    let live = true;
    Promise.all([once(metas, slug, () => json<SubjectMeta>(subjectFile(slug))), once(parts, slug, () => json<BankRow[]>(bankFile(slug, "parts")))])
      .then(([meta, rows]) => { if (live) setGot({ slug, attempt, meta, rows }); })
      .catch(() => { if (live) setGot("error"); });
    return () => { live = false; };
  }, [slug, attempt]);
  if (!slug) return { state: "loading" };
  if (got === "error") return { state: "error" };
  if (!got || got.slug !== slug) return { state: "loading" };
  return { state: "ready", meta: got.meta, rows: got.rows };
}

/** The papers' full text, folded for searching, once `wanted` (someone has typed). Folded in slices so the page stays responsive. */
export function useBankText(slug: string | null, wanted: boolean): Record<string, string> | null {
  const [got, setGot] = useState<{ slug: string; text: Record<string, string> } | null>(null);
  useEffect(() => {
    if (!slug || !wanted) return;
    let live = true;
    once(texts, slug, async () => {
      const raw = await json<Record<string, string>>(bankFile(slug, "text"));
      const out: Record<string, string> = {};
      const keys = Object.keys(raw);
      for (let i = 0; i < keys.length; i += 400) {
        for (const k of keys.slice(i, i + 400)) out[k] = fold(raw[k]);
        await new Promise((r) => setTimeout(r, 0));
      }
      return out;
    }).then((text) => { if (live) setGot({ slug, text }); }).catch(() => {});
    return () => { live = false; };
  }, [slug, wanted]);
  return got && got.slug === slug ? got.text : null;
}
