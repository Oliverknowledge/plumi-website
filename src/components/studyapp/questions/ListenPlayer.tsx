"use client";

import { useState } from "react";
import { papersBase } from "@/lib/studyapp/questions/cropUrls";
import { wholeRecordingNote } from "@/lib/studyapp/questions/feed";
import type { QPart } from "@/lib/studyapp/questions/model";

/**
 * A listening question's recording, under its picture: a labelled player (nothing is fetched until it is played), the note when the recording is the whole paper's, the
 * transcript to check against once the student has marked or opened the scheme, and, if the recording will not play, a calm line pointing to the whole paper instead
 * of a task that cannot be done.
 */
export function ListenPlayer({ part, transcript, checked, onWhole }: { part: Pick<QPart, "l" | "au" | "auw">; transcript: string | null; checked: boolean; onWhole?: () => void }) {
  const [failed, setFailed] = useState(false);
  if (!part.au) return null;
  const src = `${papersBase}/${part.au}`;
  return (
    <div className="qf-listen" data-testid="listen">
      <p className="qf-listen-label" id={`listen-${part.l}`}>Listen</p>
      {failed ? (
        <p className="qf-listen-note" role="status">
          Listening: the recording would not play here. {onWhole ? <button type="button" className="qs-link" onClick={onWhole}>Open the whole paper for the recording</button> : "Open the whole paper for the recording."}
          {" "}<button type="button" className="qs-link" onClick={() => setFailed(false)}>Try again</button>
        </p>
      ) : (
        <audio controls preload="none" src={src} aria-label={`The recording for question ${part.l}`} onError={() => setFailed(true)} />
      )}
      {part.auw && !failed && <p className="qf-listen-note">{wholeRecordingNote(part.l)}</p>}
      {transcript && checked && <p className="qf-listen-note"><a href={`${papersBase}/${transcript}`} target="_blank" rel="noopener noreferrer">Transcript to check against (PDF)</a></p>}
    </div>
  );
}
