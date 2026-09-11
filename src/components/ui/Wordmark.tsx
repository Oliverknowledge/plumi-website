import { Quill } from "@/components/quill/Quill";

/** The wordmark: the quill, winking, beside the name — as on the app's own logo. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <Quill mood="wink" size={22} className="wordmark-quill" />
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
        Plumi
      </span>
    </span>
  );
}
