/**
 * The wordmark.
 *
 * There is no app icon in the repository — no asset catalogue exists yet — so
 * this is built from the one mark the product already owns: the four-pointed
 * star. It is folded into the mascot's chest, and it is the glyph on the AI Pen
 * in the tool tray. Using it here means the website is not inventing a logo; it
 * is using the product's.
 *
 * The star is drawn with concave sides rather than as a rotated square, which
 * is what makes it read as a spark rather than as a diamond.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 0.8c.9 5.6 4.7 9.4 10.3 10.3v1.8C16.7 13.8 12.9 17.6 12 23.2h-1.8C9.3 17.6 5.5 13.8 0 12.9v-1.8C5.5 10.2 9.3 6.4 10.2 0.8H12Z"
          fill="var(--color-blue-600)"
        />
      </svg>
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
        Plumi
      </span>
    </span>
  );
}
