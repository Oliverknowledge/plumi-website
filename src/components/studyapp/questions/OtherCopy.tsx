"use client";

import { useEffect, useState } from "react";
import { getAnswerImage } from "@/lib/studyapp/questions/answerImage";
import { hasInk, type QAnswer } from "@/lib/studyapp/questions/model";

/**
 * The same question's answer from another place, shown READ ONLY and faded and dashed in the empty writing box, with one clear line at the top: where it is from, "See it" (opens that
 * place at this question) and "Continue here" (copies it into this box, on the student's tap only). Typing is shown as text, handwriting as a picture of the ink.
 * It is gone as soon as there is anything in this box. The box beneath stays writable: it is only in the way of the eye, never of a pen.
 */
export function OtherCopy({ partId, setId, answer, label, onSee, onContinue, code = false }: { code?: boolean; partId: string; setId: string; answer: QAnswer; label: string; onSee(): void; onContinue(): void }) {
  const [img, setImg] = useState<string | null>(null);
  const ink = hasInk(answer);
  useEffect(() => {
    if (!ink) return;
    let live = true;
    void getAnswerImage(partId, { setId }).then((u) => { if (live) setImg(u); }).catch(() => undefined);
    return () => { live = false; };
  }, [ink, partId, setId, answer.ink?.n]);
  return (
    <div className="qf-other" data-testid="other-copy">
      <p className="qf-other-line">
        <span>{label}</span>
        <button type="button" className="qs-link" onClick={onSee}>See it</button>
        <button
          type="button" className="qs-mini qf-continue" data-testid="continue-here"
          onClick={(e) => {
            // This button goes away with the copy: focus moves on to the writing space (the box or the pen's canvas), not to the page.
            const zone = e.currentTarget.closest(".qs-answer");
            onContinue();
            let tries = 0;
            const t = setInterval(() => {
              const to = zone?.querySelector<HTMLElement>("textarea, canvas");
              if (to) {
                to.focus({ preventScroll: true });
                // Continue after what was already written, not in front of it.
                if (to instanceof HTMLTextAreaElement) to.setSelectionRange(to.value.length, to.value.length);
                clearInterval(t);
              } else if (++tries > 20) clearInterval(t);
            }, 60);
          }}
        >Continue here</button>
      </p>
      <div className="qf-other-body" role="img" aria-label={`Your earlier answer: ${answer.text?.trim() || (ink ? "handwriting" : "")}`}>
        {answer.text?.trim() ? <p className={code ? "is-code" : "is-hand"}>{answer.text}</p> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={img} alt="" />}
      </div>
    </div>
  );
}
