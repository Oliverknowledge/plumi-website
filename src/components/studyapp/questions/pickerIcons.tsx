import type { ReactNode } from "react";

/** The picker's own small line icons (24px grid, `currentColor`), beside the sheet's in icons.tsx. */
const I = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
export const FilterIcon = () => <I><path d="M4 6h16M7 12h10M10 18h4" /></I>;
export const ShuffleIcon = () => <I><path d="M4 7h3.5c5 0 4 10 9 10H20" /><path d="M17 14l3 3-3 3" /><path d="M4 17h3.5c1.6 0 2.6-1 3.4-2.4" /><path d="M13.2 9.4C14 8 15 7 16.5 7H20" /><path d="M17 4l3 3-3 3" /></I>;
export const ChevronIcon = () => <I size={16}><path d="M6 9l6 6 6-6" /></I>;
