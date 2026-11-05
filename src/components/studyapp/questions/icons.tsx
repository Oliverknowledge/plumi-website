import type { ReactNode } from "react";

/** Small line icons for the pen tray and sheet, drawn at 24px, `currentColor`. No emoji. */
const I = ({ children, size = 22 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
export const PenIcon = () => <I><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z" /><path d="M14 7l3 3" /></I>;
export const EraserIcon = () => <I><path d="M8 20h11" /><path d="M5 15l8.5-8.5a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8L11 20H8l-3-3a1.4 1.4 0 010-2z" /></I>;
export const RulerIcon = () => <I><path d="M3.5 17.5L17.5 3.5l3 3-14 14z" /><path d="M7.2 13.8l1.6 1.6M10 11l1.6 1.6M12.8 8.2l1.6 1.6" /></I>;
export const UndoIcon = () => <I><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></I>;
export const RedoIcon = () => <I><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 000 12h3" /></I>;
export const TrashIcon = () => <I><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></I>;
export const GridIcon = () => <I><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 12h16M12 4v16" /></I>;
export const HandIcon = () => <I><path d="M8 13V6a1.5 1.5 0 013 0v5" /><path d="M11 11V4.5a1.5 1.5 0 013 0V11" /><path d="M14 11V6a1.5 1.5 0 013 0v8a6 6 0 01-6 6h-1a5 5 0 01-4-2l-3-4a1.5 1.5 0 012.3-1.8L8 15" /></I>;
export const BoltIcon = () => <I size={18}><path d="M13 3L5 13h6l-1 8 8-10h-6z" /></I>;
export const CheckIcon = () => <I size={18}><path d="M5 12.5l4.5 4.5L19 7" /></I>;
export const BackIcon = () => <I size={18}><path d="M15 5l-7 7 7 7" /></I>;
export const TypeIcon = () => <I size={18}><path d="M5 7V5h14v2M12 5v14M9 19h6" /></I>;
export const PenSmallIcon = () => <I size={18}><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z" /></I>;
export const PlusIcon = () => <I size={18}><path d="M12 5v14M5 12h14" /></I>;
export const CloseIcon = () => <I size={18}><path d="M6 6l12 12M18 6L6 18" /></I>;
export const SearchIcon = () => <I size={18}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></I>;
export const ExpandIcon = () => <I size={18}><path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4" /></I>;
export const RetryIcon = () => <I size={20}><path d="M20 12a8 8 0 11-2.6-5.9" /><path d="M20 4v5h-5" /></I>;
export const ReportIcon = () => <I size={18}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h6" /></I>;
export const TextIcon = () => <I size={16}><path d="M4 19l5-14 5 14M6 14h6" /><path d="M16 12h4M16 16h4M16 8h4" /></I>;
