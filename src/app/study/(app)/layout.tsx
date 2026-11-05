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
import "./settings.css";
import "./dark-app.css";

/**
 * The study app: Desk, Study (the Grand Library) and Flashcards, at study.tryplumi.app. One deliberate light
 * look, the iPad's blue on the website's notebook paper (docs/study/app.md), and a dark one a student can choose in Settings (dark-app.css turns the page over and its pictures back). Everything is scoped under
 * `.pa`, so this stylesheet and the marketing site's never meet.
 *
 * The record player (lofi) lives here, beside the pages rather than in them, so the music carries on from page to page.
 *
 * Not indexable while it is being built: nothing here is a page a search should send anyone to yet.
 */
const digit = VT323({ weight: "400", subsets: ["latin"], display: "swap", variable: "--pa-font-digit" });

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#f2f7fd", colorScheme: "light" };

/**
 * Dark is the student's own choice (Settings), never the device's: the site's script (lib/theme.ts) follows the device when nothing is saved, which would turn the whole app
 * over for every student whose phone is in dark mode. Here only a saved "dark" counts; anything else is light, as the app always was. Runs before the first paint.
 */
const lightUnlessChosen = 'try{if(localStorage.getItem("plumi-theme")!=="dark")document.documentElement.dataset.theme="light"}catch(e){document.documentElement.dataset.theme="light"}';

export default function StudyAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`pa ${digit.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: lightUnlessChosen }} />
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
