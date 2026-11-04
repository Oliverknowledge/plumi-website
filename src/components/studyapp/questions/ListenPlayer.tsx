"use client";

import { useId, useState } from "react";
import { papersBase } from "@/lib/studyapp/questions/cropUrls";
import { wholeRecordingNote } from "@/lib/studyapp/questions/feed";
import type { QPart } from "@/lib/studyapp/questions/model";

/** The recording playing now: starting another pauses it, so two never play over each other. */
let playing: HTMLAudioElement | null = null;

/**
 * A listening question's recording, under its picture: a labelled player (nothing is fetched until it is played), the note when the recording is the whole paper's, the
 * transcript to check against once the student has marked or opened the scheme, and, if the recording will not play, a calm line pointing to the whole paper instead
 * of a task that cannot be done.
 */
export function ListenPlayer({ part, transcript, checked, onWhole }: { part: Pick<QPart, "l" | "au" | "auw">; transcript: string | null; checked: boolean; onWhole?: () => void }) {
  const [failed, setFailed] = useState(false);
  const label = useId();
  if (!part.au) return null;
  const src = `${papersBase}/${part.au}`;
  return (
    <div className="qf-listen" data-testid="listen">
      <p className="qf-listen-label" id={label}>Listen</p>
      {failed ? (
        <p className="qf-listen-note" role="status">
          Listening: the recording would not play here. {onWhole && <><button type="button" className="qs-link" onClick={onWhole}>Open the whole paper for the recording</button>{" "}</>}<button type="button" className="qs-link" onClick={() => setFailed(false)}>Try again</button>
        </p>
      ) : (
        <audio
          controls preload="none" src={src} aria-label={`Listen, the recording for question ${part.l}`} onError={() => setFailed(true)}
          onPlay={(e) => { if (playing && playing !== e.currentTarget) playing.pause(); playing = e.currentTarget; }}
          onEnded={(e) => { if (playing === e.currentTarget) playing = null; }}
        />
      )}
      {part.auw && !failed && <p className="qf-listen-note">{wholeRecordingNote(part.l)}</p>}
      {transcript && (checked || failed) && <p className="qf-listen-note"><a href={`${papersBase}/${transcript}`} target="_blank" rel="noopener noreferrer">Transcript to check against (PDF)</a></p>}
    </div>
  );
}
