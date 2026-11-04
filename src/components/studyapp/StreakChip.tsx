/** The flame of a day streak, drawn small (the library's friends use the same one). */
export const Flame = () => (
  <svg viewBox="0 0 9 11" aria-hidden="true" focusable="false"><path d="M4.5 0C5 2 3 3 3 5.200 3 6 3.300 6.500 3.800 6.800 3.600 5.600 4.900 5 5.300 3.600 6.800 4.600 8 6 8 7.600A3.500 3.500 0 0 1 4.500 11 3.500 3.500 0 0 1 1 7.600C1 6.400 1.500 5.500 2.100 4.800 2.200 5.500 2.500 5.900 2.800 6 2.400 4 4 2 4.500 0Z" fill="currentColor" /></svg>
);

/**
 * The student's day streak: a small gold tag with a flame and the number, tilted a little like a sticker. Nothing at 0 (the caller says one quiet line instead, or
 * nothing), nothing while the number is not known. The tag's name is "7 day streak"; the words beside the number are drawn for sighted eyes only.
 */
export function StreakChip({ n, className = "" }: { n: number | null; className?: string }) {
  if (!n || n < 1) return null;
  return (
    <span className={`sk-chip ${className}`.trim()} role="img" aria-label={`${n} day streak`} data-testid="streak-chip" data-n={n}>
      <Flame /><b>{n}</b><span className="sk-w" aria-hidden="true">day streak</span>
    </span>
  );
}
