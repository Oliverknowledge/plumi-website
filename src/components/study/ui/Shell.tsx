import type { ReactNode } from "react";
import { Mascot } from "./Mascot";
import { PixelIcon } from "./PixelIcon";

export type NavItem = { href: string; label: string };

/** The wordmark: the mascot, then "plumi" in pixel type, lower case. */
export function Logo({ href = "/study" }: { href?: string }) {
  return (
    <a className="st-logo" href={href} aria-label="Plumi, home">
      <Mascot pose="idle" height={44} />
      <span aria-hidden="true">plumi</span>
    </a>
  );
}

/**
 * The top bar: wordmark, four places, then the streak and the student. Pure presentation: the
 * caller says which place is `current` (the app will read the path in a client wrapper).
 * Narrow screens give the places their own row that scrolls sideways, so none is ever hidden.
 */
export function AppHeader({
  nav, current, end,
}: { nav: readonly NavItem[]; current?: string; end?: ReactNode }) {
  return (
    <header className="st-header">
      <Logo />
      <nav className="st-nav" aria-label="Plumi">
        {nav.map((n) => (
          <a key={n.href} href={n.href} aria-current={current === n.href ? "page" : undefined}>{n.label}</a>
        ))}
      </nav>
      {end && <div className="st-header-end">{end}</div>}
    </header>
  );
}

/** The header's streak chip. The number is Nunito; the flame is the one two-tone pixel icon. */
export function StreakPill({ days }: { days: number }) {
  return (
    <span className="st-pill">
      <PixelIcon name="flame" size={24} />
      <span className="st-num">{days}</span>
      <span>day streak</span>
    </span>
  );
}

/** The student, as an initial on a mint tile. */
export function Avatar({ initial, tone, href }: { initial: string; tone?: "pink" | "yellow" | "green"; href?: string }) {
  const cls = `st-avatar${tone ? ` st-avatar--${tone}` : ""}`;
  return href
    ? <a className={cls} href={href} aria-label="Your account">{initial}</a>
    : <span className={cls} aria-hidden="true">{initial}</span>;
}
