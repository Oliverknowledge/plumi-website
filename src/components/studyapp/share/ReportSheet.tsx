"use client";

import { useState } from "react";
import { canRetry, createSharing, reasonLine, REPORT_REASONS, restApi, siteRestConfig, type ReportReason } from "@/lib/studyapp/sharing";
import { PageSheet } from "./PageSheet";

/** "Report this deck": a few reasons to tap, then one line to say it was sent. No sign-in; the deck's code and the reason are all that is sent. */
export function ReportSheet({ code, onClose, onSent }: { code: string; onClose: () => void; onSent: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [line, setLine] = useState("");

  const send = async () => {
    if (!reason || state === "sending") return;
    setState("sending");
    const r = await createSharing(restApi(siteRestConfig())).report(code, reason);
    if (r.ok) { setState("sent"); onSent(); return; }
    // A deck that is already gone needs no report: say thanks all the same. Anything else is a line and another try.
    if (r.reason === "not_found") { setState("sent"); onSent(); return; }
    setLine(canRetry(r.reason) ? reasonLine(r.reason) : reasonLine("other"));
    setState("failed");
  };

  return (
    <PageSheet title="Report this deck" onClose={onClose}>
      {state === "sent" ? (
        <>
          <p className="sh-line" role="status" data-testid="report-done">Thanks. We will take a look.</p>
          <div className="sh-acts"><button type="button" className="btn gold" onClick={onClose} data-autofocus>Close</button></div>
        </>
      ) : (
        <>
          <fieldset className="sh-reasons">
            <legend className="sr">Why are you reporting it?</legend>
            {REPORT_REASONS.map((r, i) => (
              <label key={r.id} className={reason === r.id ? "on" : undefined}>
                <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} data-autofocus={i === 0 ? "" : undefined} data-testid={`reason-${r.id}`} />
                <span>{r.label}</span>
              </label>
            ))}
          </fieldset>
          {state === "failed" && <p className="sh-line sh-soft" role="status" data-testid="report-failed">{line}</p>}
          <div className="sh-acts">
            <button type="button" className="btn gold" disabled={!reason || state === "sending"} onClick={() => void send()} data-testid="report-send">{state === "sending" ? "Sending" : state === "failed" ? "Try again" : "Send"}</button>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </PageSheet>
  );
}
