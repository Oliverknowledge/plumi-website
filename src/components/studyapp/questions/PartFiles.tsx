import type { Special } from "@/lib/studyapp/questions/specials";

/**
 * The paper's own files a question needs beside its picture: the booklet its sources, texts or resources are printed in, the code files of a paper sat on
 * screen, the transcript of a recording. A link out, labelled by what it is (the same files the public question bank offers on a question).
 */
export function PartFiles({ files, className = "" }: { files: readonly Special[]; className?: string }) {
  if (!files.length) return null;
  return (
    <p className={`qf-files ${className}`} data-testid="part-files">
      {files.map((f) => (
        <a key={f.kind} className="qf-file" href={f.href} {...(f.download ? { download: "" } : { target: "_blank", rel: "noopener noreferrer" })} data-kind={f.kind}>
          <svg viewBox="0 0 20 24" width="16" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 2h8l5 5v15H4z" /><path d="M12 2v5h5" /><path d="M7 13h7M7 17h7" /></svg>
          <span>{f.label}</span>
          {!f.download && <span className="qs-sr"> (opens in a new tab)</span>}
        </a>
      ))}
    </p>
  );
}
