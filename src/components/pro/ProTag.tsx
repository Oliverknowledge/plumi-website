/** The small "Pro" pill that marks a Pro thing (a deck, a group, a row): the lofi tag, in one place. Decoration: the surrounding label says "Pro" to a screen reader. */
export function ProTag({ className = "", label = "Pro" }: { className?: string; label?: string }) {
  return <span className={`pro-tag ${className}`.trim()} data-testid="pro-tag">{label}</span>;
}
