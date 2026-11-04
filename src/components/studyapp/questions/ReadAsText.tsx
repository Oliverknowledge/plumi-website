"use client";

import { useEffect, useState } from "react";
import { mathsLike } from "@/lib/studyapp/questions/approx";
import { bankFile } from "@/lib/studyapp/questions/cropUrls";
import { getMeta } from "./bankData";
import type { QPart, QSet } from "@/lib/studyapp/questions/model";
import { partSchemeText, partText, questionText, type PartText, type SchemeText as SchemeTextData } from "@/lib/studyapp/questions/partText";

/** Where the subject's text file is (its hash is in the meta), or null where it has none. */
const textUrl = (slug: string): Promise<string | null> => getMeta(slug).then((m) => bankFile(slug, m.data, "text")).catch(() => null);

/**
 * "Read as text" under a part's picture, for a screen reader, text to speech, or a student the picture is hard for.
 * Fetched only when it is opened (the subject's text file is up to a couple of megabytes), and it shows the question,
 * never the mark scheme (partText.ts says how that is kept true). A short question is whole; only a long one says the picture has the rest.
 */
export function ReadAsText({ set, part }: { set: Pick<QSet, "subject">; part: QPart }) {
  const [open, setOpen] = useState(false);
  const [got, setGot] = useState<PartText | null>(null);
  useEffect(() => {
    if (!open || got) return;
    let live = true;
    void textUrl(set.subject).then((url) => (url ? partText(set.subject, part, url) : questionText(undefined, part))).then((t) => { if (live) setGot(t); });
    return () => { live = false; };
  }, [open, got, set.subject, part]);
  return (
    <details className="qs-astext" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Read as text</summary>
      {open && (got === null ? <p className="qs-scheme-note" role="status">Opening...</p> : got.text ? (
        <div className="qs-astext-body">
          <p lang="en-GB">{got.text}</p>
          {mathsLike(set.subject) && <p className="qs-scheme-note" data-testid="astext-approx">Approximate: a fraction or a power can lose its layout here. The picture is exact.</p>}
          {!got.whole && <p className="qs-scheme-note">This is the start of the question. The picture has the rest.</p>}
        </div>
      ) : <p className="qs-scheme-note">There is no text for this question. The picture has it.</p>)}
    </details>
  );
}

/**
 * "Read as text" for the MARK SCHEME of a part, inside the scheme card (so it is only ever shown once the student has asked for the
 * scheme): a student who cannot read the picture can still mark themselves. The paper's text is a scan's text, so the note says a table can
 * read out of order and the picture is the real thing.
 */
export function SchemeText({ set, part }: { set: Pick<QSet, "subject">; part: QPart }) {
  const [open, setOpen] = useState(false);
  const [got, setGot] = useState<SchemeTextData | null | undefined>(undefined);   // undefined: not asked, null: would not load
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!open || (got !== undefined && got !== null)) return;
    let live = true;
    void textUrl(set.subject).then((url) => (url ? partSchemeText(set.subject, part, url) : null)).then((t) => { if (live) setGot(t); });
    return () => { live = false; };
  }, [open, got, set.subject, part, tries]);
  if (!part.ms) return null;
  return (
    <details className="qs-astext qs-astext-scheme" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Read the mark scheme as text</summary>
      {open && (got === undefined ? <p className="qs-scheme-note" role="status">Opening...</p> : got === null ? (
        <p className="qs-scheme-note">Could not open it. <button type="button" className="qs-link" onClick={() => { setGot(undefined); setTries((t) => t + 1); }}>Try again</button></p>
      ) : got.text ? (
        <div className="qs-astext-body">
          <p lang="en-GB">{got.text}</p>
          <p className="qs-scheme-note">From the scan, so a table can read out of order. The picture is the real thing.</p>
        </div>
      ) : <p className="qs-scheme-note">There is no text for this mark scheme. The picture has it.</p>)}
    </details>
  );
}
