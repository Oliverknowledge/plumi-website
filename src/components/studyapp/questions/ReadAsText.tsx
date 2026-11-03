"use client";

import { useEffect, useState } from "react";
import { bankFile } from "@/lib/studyapp/questions/cropUrls";
import type { QPart, QSet } from "@/lib/studyapp/questions/model";
import { partText, type PartText } from "@/lib/studyapp/questions/partText";

/**
 * "Read as text" under a part's picture, for a screen reader, text to speech, or a student the picture is hard for.
 * Fetched only when it is opened (the subject's text file is up to a couple of megabytes), and it shows the question,
 * never the mark scheme (partText.ts says how that is kept true).
 */
export function ReadAsText({ set, part }: { set: Pick<QSet, "subject">; part: QPart }) {
  const [open, setOpen] = useState(false);
  const [got, setGot] = useState<PartText | null>(null);
  useEffect(() => {
    if (!open || got) return;
    let live = true;
    void partText(set.subject, part, bankFile(set.subject, "text")).then((t) => { if (live) setGot(t); });
    return () => { live = false; };
  }, [open, got, set.subject, part]);
  return (
    <details className="qs-astext" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Read as text</summary>
      {open && (got === null ? <p className="qs-scheme-note" role="status">Opening...</p> : got.text ? (
        <div className="qs-astext-body">
          <p lang="en-GB">{got.text}</p>
          {!got.whole && <p className="qs-scheme-note">That is only the start of the question. The picture has all of it.</p>}
        </div>
      ) : <p className="qs-scheme-note">There is no text for this question. The picture has it.</p>)}
    </details>
  );
}
