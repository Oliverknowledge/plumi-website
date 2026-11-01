import type { Metadata } from "next";
import { lookScript } from "@/components/study/appearance";
import "../tokens.css";
import "../components.css";

/**
 * The study app's root. Everything under /study (which study.tryplumi.app will serve) sits in
 * `.st`, so its styles and the marketing site's can never reach each other.
 *
 * Not indexable for now: nothing here is a page a search should send anyone to yet.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="st">
      {/* The look is set before first paint, as the site's theme is, so there is no flash. */}
      <script dangerouslySetInnerHTML={{ __html: lookScript }} />
      {children}
    </div>
  );
}
