import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CtaButton, SecondaryCta } from "@/components/ui/CtaButton";
import { Quill } from "@/components/quill/Quill";
import { QuillFlight } from "@/components/quill/QuillFlight";
import { LaunchCountdown, TutorMedia, NotebookGallery, Comparison } from "@/components/scenes/StoryMedia";
import { MechanicsStory } from "@/components/scenes/MechanicsStory";
import { LearnerTree } from "@/components/scenes/LearnerTree";
import { PracticeCard } from "@/components/scenes/PracticeCard";
import { FocusScene } from "@/components/scenes/FocusScene";
import { InkSignature } from "@/components/scenes/InkSignature";
import { specifications } from "@/content/story";

export function LandingPage({ variant }: { variant?: string }) {
  return <div className="plumi-story" data-variant={variant}><SiteHeader/><main id="main">
    <section id="product" className="hero-section" data-testid="hero-section"><div className="story-container hero-layout"><div className="hero-copy">
      <div className="hero-kicker reveal-line"><span className="small-blue-dot"/> A NEW CHAPTER IN STUDYING</div>
      <h1 data-testid="hero-headline"><span className="reveal-line"><span>Your handwriting.</span></span><span className="reveal-line"><span>Read, understood,</span></span><span className="reveal-line"><span className="tutor-word">visualised.<svg viewBox="0 0 240 16" fill="none" aria-hidden="true"><path d="M4 10Q97 0 231 7M13 15Q115 5 215 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></span></span></h1>
      {/* The headline is a promise; this is the definition. A crawler landing
          here needs one sentence that says the category out loud — AI study
          notebook, GCSE and A-Level — because "Your handwriting. Read,
          understood, visualised." never does. Kept to one added clause so it
          still reads as product copy rather than a keyword list. */}
      <p className="hero-description reveal-line">Plumi is the AI study notebook for GCSE and A-Level. Write the way you already do — it reads your working, tutors you on the page, and knows what you should practise next.</p>
      <div className="hero-cta reveal-line"><CtaButton placement="hero" size="large"/><SecondaryCta label="Watch it click" href="#how-it-works" placement="hero"/></div>
      <div className="hero-platform reveal-line"><svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true"><rect x="2" y="1" width="12" height="18" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M6 16h4" stroke="currentColor" strokeWidth="1.2"/></svg>Made for iPad & Apple Pencil</div>
      <LaunchCountdown/>
    </div><div className="hero-product"><Quill mood="happy" size={132} className="hero-quill" label="Plumi, the quill"/><TutorMedia/></div></div>
    </section>
    <section id="on-page" className="on-page-section" aria-labelledby="on-page-title"><QuillFlight className="flight-hero" d="M60 20C220 40 300 170 520 150C700 134 760 60 1130 92" mood="curious" duration={3}/><div className="story-container on-page-layout">
      <div className="on-page-copy"><div className="scene-eyebrow"><span>01</span> THE PAGE BECOMES THE TUTOR</div><h2 id="on-page-title">Not in another tab.<br/><span className="muted-line">Right where you’re thinking.</span></h2><p>No prompt to type. No context to explain. Plumi reads your working and answers in the margin, in handwriting, while the pen is still in your hand.</p></div>
      <figure className="practice-crop on-page-crop"><Image src="/product/next-question.webp" width={1100} height={300} alt="Real Plumi Tutor handwriting: Yes. Now try this one. Integral of e to the 3x." sizes="(max-width: 700px) 90vw, 640px"/><figcaption>From Oliver’s actual Tutor session</figcaption></figure>
    </div></section>
    <MechanicsStory/>
    <LearnerTree/>
    <PracticeCard/>
    <FocusScene/>
    <section id="notebook" className="notebook-section"><div className="story-container"><div className="section-topline"><div><div className="scene-eyebrow"><span>07</span> STILL YOUR NOTEBOOK</div><h2>All your notes.<br/><span className="muted-line">Not another subscription.</span></h2></div><div className="free-notes-aside"><span className="free-tag">FREE TO WRITE. ALWAYS.</span><p>Everything you need to take notes is free in Plumi: handwriting, folders, PDFs and your favourite tools. <span className="mobile-hide">If you know Goodnotes or Notability, you already know how it works.</span><b>Stop paying just to write.</b></p></div></div><NotebookGallery/></div></section>
    <section className="memory-section story-container" aria-labelledby="memory-title"><div className="memory-copy"><div className="scene-eyebrow"><span>08</span> EVERY PAGE ADDS UP</div><h2 id="memory-title">A fresh page.<br/><span className="muted-line">Not a fresh start.</span></h2><p>Plumi knows your specification and remembers the work you’ve done, so Home always has one honest next step waiting.</p><ul className="spec-chips" aria-label="Specifications Plumi knows">{specifications.map(s => <li key={s}>{s}</li>)}<li className="spec-more">+ more A-Level specs</li></ul></div><div className="memory-proof"><div className="memory-loop" aria-label="Your work leads to evidence, then practice, then stronger understanding"><span>Your work</span><i>→</i><span>What it reveals</span><i>→</i><span>Your next step</span></div><figure><picture><source media="(max-width: 700px)" srcSet="/product/next-move-mobile.webp"/><img src="/product/next-move.webp" alt="Real Home recommendation: Electrical circuits. Still weak after four pieces of marked work. 12 minutes, 4 questions." width="1400" height="328" loading="lazy"/></picture><figcaption>One recommendation. Grounded in your actual work.</figcaption></figure></div></section>
    <section id="compare" className="compare-section story-container"><div className="compare-heading"><div className="scene-eyebrow"><span>09</span> A DIFFERENT WAY TO STUDY</div><h2>Your notes and your tutor.<br/><span className="muted-line">Finally on the same page.</span></h2></div><Comparison/></section>
    <section id="community" className="community-section" data-testid="community-section"><div className="story-container community-layout"><div className="community-eyebrow">GOOD QUESTIONS START SOMETHING.</div><h2 className="sr-only">Help write the next chapter.</h2><InkSignature/><div className="community-copy"><p>Join the Plumi community. Meet the team, share your ideas, and follow the journey to launch.</p><CtaButton placement="footer" label="Join the Plumi community" size="large"/><LaunchCountdown variant="footer"/></div></div></section>
  </main><SiteFooter/></div>;
}
