import type { Metadata, Viewport } from "next";
import { VT323 } from "next/font/google";
import { AuthGate } from "@/components/studyapp/AuthGate";
import { AppTop } from "@/components/studyapp/AppTop";
import { TimerEffects } from "@/components/studyapp/timer/TimerEffects";
import { Toaster } from "@/components/studyapp/toast";
import { Vinyl } from "@/components/studyapp/Vinyl";
import "./app.css";
import "./timer.css";
import "./vinyl.css";

/**
 * The study app: Desk, Study (the Grand Library) and Flashcards, at study.tryplumi.app. One deliberate light
 * look, the iPad's blue on the website's notebook paper (docs/study/app.md). Everything is scoped under
 * `.pa`, so this stylesheet and the marketing site's never meet.
 *
 * The record player (lofi) lives here, beside the pages rather than in them, so the music carries on from page to page.
 *
 * Not indexable while it is being built: nothing here is a page a search should send anyone to yet.
 */
const digit = VT323({ weight: "400", subsets: ["latin"], display: "swap", variable: "--pa-font-digit" });

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#f2f7fd", colorScheme: "light" };

export default function StudyAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`pa ${digit.variable}`}>
      <AuthGate>
        <AppTop />
        {children}
        <TimerEffects />
        <Toaster />
        <Vinyl />
      </AuthGate>
    </div>
  );
}
