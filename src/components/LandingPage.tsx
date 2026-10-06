import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StickyCta } from "@/components/StickyCta";
import { SectionImpressions } from "@/components/SectionImpressions";
import { CtaButton, SecondaryCta } from "@/components/ui/CtaButton";
import { Quill } from "@/components/quill/Quill";
import { TutorMedia } from "@/components/scenes/StoryMedia";
import { TheMark } from "@/components/scenes/TheMark";
import { LearnerTree } from "@/components/scenes/LearnerTree";
import { PracticeCard } from "@/components/scenes/PracticeCard";
import { InkSignature } from "@/components/scenes/InkSignature";
import { subjects, boards } from "@/content/story";
import { proOptions } from "@/content/plans";

/**
 * The homepage: a hero, three drawn scenes, a strip, a close.
 *
 *   HERO        name, one line, the App Store button, the product
 *   THE MARK    a marked page, drawn
 *   THE MAP     what the marks teach Plumi about you, drawn
 *   THE NEXT    the question that follows from it, drawn
 *   SUBJECTS    STEM at A-Level and GCSE, and the boards
 *   CLOSE       the button again
 *
 * The page used to run to thirteen numbered chapters of prose. The product's
 * own rule applies to its website: a title, at most one short line, and the
 * rest drawn. What was cut (trust, evidence, exam mode, the notebook and focus
 * chapters, the diagram scene, the comparison table, pricing, FAQ, the launch
 * email form) either repeated the three scenes above or explained something
 * the App Store listing already says.
 */
export function LandingPage({ variant }: { variant?: string }) {
  const yearly = proOptions[0];
  const monthly = proOptions[1];
  return <div className="plumi-story" data-variant={variant}><SiteHeader/><main id="main">

    <section id="product" className="hero-section" data-testid="hero-section"><div className="story-container hero-layout"><div className="hero-copy">
      <div className="hero-kicker reveal-line"><span className="small-blue-dot"/> STEM FOR A-LEVEL AND GCSE</div>
      <h1 data-testid="hero-headline"><span className="reveal-line"><span>Your handwriting.</span></span><span className="reveal-line"><span>Read, understood,</span></span><span className="reveal-line"><span className="tutor-word">visualised.<svg viewBox="0 0 240 16" fill="none" aria-hidden="true"><path d="M4 10Q97 0 231 7M13 15Q115 5 215 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></span></span></h1>
      <p className="hero-description reveal-line">Write by hand. Plumi reads it, marks it and picks what to practise next.</p>
      <div className="hero-cta reveal-line"><CtaButton placement="hero" size="large"/><SecondaryCta label="Watch a mark land" href="#the-mark" placement="hero"/></div>
      <div className="hero-platform reveal-line"><svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true"><rect x="2" y="1" width="12" height="18" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M6 16h4" stroke="currentColor" strokeWidth="1.2"/></svg>Made for iPad & Apple Pencil</div>
    </div><div className="hero-product"><Quill mood="happy" size={132} className="hero-quill" label="Plumi, the quill"/><TutorMedia/></div></div>
    </section>

    <TheMark/>
    <LearnerTree/>
    <PracticeCard/>

    <section id="subjects" className="subjects-strip story-container" aria-labelledby="subjects-title">
      <h2 id="subjects-title">STEM for A-Level <span className="muted-line">and GCSE.</span></h2>
      <ul className="spec-chips" aria-label="Subjects">{subjects.map(s => <li key={s}>{s}</li>)}</ul>
      <ul className="spec-chips" aria-label="Exam boards">{boards.map(b => <li key={b}>{b}</li>)}</ul>
    </section>

    <section id="close" className="community-section" data-testid="community-section"><div className="story-container community-layout"><h2 className="sr-only">Write like you always have. Find out what it proves.</h2><InkSignature/><div className="community-copy">
      <CtaButton placement="close" size="large"/>
      <p className="close-price">Free to write in. Pro is {yearly.price} {yearly.period} or {monthly.price} {monthly.period}.</p>
    </div></div></section>

  </main><SiteFooter/><StickyCta/><SectionImpressions/></div>;
}
