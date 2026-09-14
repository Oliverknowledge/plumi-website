import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StickyCta } from "@/components/StickyCta";
import { SectionImpressions } from "@/components/SectionImpressions";
import { LaunchNotify } from "@/components/LaunchNotify";
import { CtaButton, SecondaryCta } from "@/components/ui/CtaButton";
import { Quill } from "@/components/quill/Quill";
import { QuillFlight } from "@/components/quill/QuillFlight";
import { LaunchCountdown, TutorMedia, NotebookGallery, Comparison } from "@/components/scenes/StoryMedia";
import { TheMark } from "@/components/scenes/TheMark";
import { Trust } from "@/components/sections/Trust";
import { WhatCounts } from "@/components/sections/WhatCounts";
import { MechanicsStory } from "@/components/scenes/MechanicsStory";
import { LearnerTree } from "@/components/scenes/LearnerTree";
import { PracticeCard } from "@/components/scenes/PracticeCard";
import { ExamMode } from "@/components/sections/ExamMode";
import { FocusBand } from "@/components/scenes/FocusScene";
import { FreeAndPro } from "@/components/sections/FreeAndPro";
import { Faq } from "@/components/sections/Faq";
import { InkSignature } from "@/components/scenes/InkSignature";
import { specifications, specificationsMore, specificationNote } from "@/content/story";
import { footer } from "@/content/nav";
import { activeCta } from "@/config/site";

/**
 * The homepage, as five arcs rather than fourteen sections.
 *
 *   ARC 1  IT READS YOU            hero · the page is the tutor · the mark
 *   ARC 2  AND YOU CAN TRUST IT    why the mark is decided that way · what counts
 *   ARC 3  AND IT REMEMBERS        the learner model · the next question · exam mode
 *   ARC 4  AND IT REPLACES YOUR STACK   the notebook · the diagram · your course
 *   ARC 5  AND HERE IS THE DEAL    comparison · free and pro · questions · close
 *
 * ── What changed, and why ───────────────────────────────────────────────────
 * The page used to be nine numbered chapters of near-equal weight with the
 * product's core claim — marking — demonstrated nowhere, and with the diagram
 * scene occupying position 02, which is the most valuable slot on the page and
 * belongs to a consequence rather than to a capability.
 *
 * The arcs are not labelled in giant type. They are felt through pacing: each
 * arc opens on paper and the one before it ends on a change of surface, the two
 * dark sections (exam mode, the close) sit at the end of arcs 3 and 5, and the
 * causal run — mark → evidence → model → next question — is now uninterrupted.
 * Focus, which used to be numbered chapter 06 in the middle of that run, is a
 * band inside the notebook chapter.
 *
 * ── The order is an argument, not a list ────────────────────────────────────
 * Every chapter inherits a belief from the one above it and hands one on. You
 * cannot ask somebody to trust a mark they have not seen, so the mark precedes
 * trust. The learner model reads as generic AI personalisation unless the rule
 * about what counts as evidence has already been stated, so "reading your notes
 * proves nothing" precedes the tree. The next question is only justified once
 * the map exists. Exam Mode spends the belief the loop has just earned.
 */
export function LandingPage({ variant }: { variant?: string }) {
  return <div className="plumi-story" data-variant={variant}><SiteHeader/><main id="main">

    {/* ── HERO ─────────────────────────────────────────────────────────────
        Unchanged where it was already right: the three-line H1, the ink
        underline on "visualised", the category sentence beneath it, the
        countdown, and the media composition. Two changes only — the secondary
        link now points at the marking chapter rather than the diagram chapter,
        and a launch-day email sits beside Discord instead of nothing. */}
    <section id="product" className="hero-section" data-testid="hero-section"><div className="story-container hero-layout"><div className="hero-copy">
      <div className="hero-kicker reveal-line"><span className="small-blue-dot"/> A NEW CHAPTER IN STUDYING</div>
      <h1 data-testid="hero-headline"><span className="reveal-line"><span>Your handwriting.</span></span><span className="reveal-line"><span>Read, understood,</span></span><span className="reveal-line"><span className="tutor-word">visualised.<svg viewBox="0 0 240 16" fill="none" aria-hidden="true"><path d="M4 10Q97 0 231 7M13 15Q115 5 215 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></span></span></h1>
      {/* The headline is a promise; this is the definition. A crawler landing
          here needs one sentence that says the category out loud — AI study
          notebook, GCSE and A-Level — because "Your handwriting. Read,
          understood, visualised." never does. Kept to one added clause so it
          still reads as product copy rather than a keyword list.

          "Marks it on the page" rather than "against the mark scheme". Both are
          true of Plumi; only the first is true of *every* student who reads
          this line. The app holds twelve A-Level specifications and no GCSE
          one, so a GCSE visitor gets the notebook, the AI Pen and marking on
          subject knowledge — and chapter 10 and the FAQ say exactly that rather
          than leaving them to find out. The board-specific claim is made where
          it is qualified, not in the one sentence nobody scrolls past. */}
      <p className="hero-description reveal-line">Plumi is the AI study notebook for GCSE and A-Level. Write the way you already do — it reads your working, marks it on the page, and knows what you should practise next.</p>
      <div className="hero-cta reveal-line"><CtaButton placement="hero" size="large"/><SecondaryCta label="Watch a mark land" href="#the-mark" placement="hero"/></div>
      <a className="hero-notify reveal-line" href="#close" data-testid="hero-notify-link">{activeCta.secondary} <span aria-hidden="true">↓</span></a>
      <div className="hero-platform reveal-line"><svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true"><rect x="2" y="1" width="12" height="18" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M6 16h4" stroke="currentColor" strokeWidth="1.2"/></svg>Made for iPad & Apple Pencil</div>
      <LaunchCountdown/>
    </div><div className="hero-product"><Quill mood="happy" size={132} className="hero-quill" label="Plumi, the quill"/><TutorMedia/></div></div>
    </section>

    {/* ═══ ARC 1 — IT READS YOU ═══════════════════════════════════════════ */}

    <section id="on-page" className="on-page-section" aria-labelledby="on-page-title"><QuillFlight className="flight-hero" d="M60 20C220 40 300 170 520 150C700 134 760 60 1130 92" mood="curious" duration={3}/><div className="story-container on-page-layout">
      <div className="on-page-copy"><div className="scene-eyebrow"><span>01</span> THE PAGE BECOMES THE TUTOR</div><h2 id="on-page-title">Not in another tab.<br/><span className="muted-line">Right where you’re thinking.</span></h2><p>No prompt to type. No context to explain. Plumi reads your working and answers in the margin, in handwriting, while the pen is still in your hand.</p></div>
      <figure className="practice-crop on-page-crop"><Image src="/product/next-question.webp" width={1100} height={300} alt="Real Plumi Tutor handwriting: Yes. Now try this one. Integral of e to the 3x." sizes="(max-width: 700px) 90vw, 640px"/><figcaption>From Oliver’s actual Tutor session</figcaption></figure>
    </div></section>

    <TheMark/>

    {/* ═══ ARC 2 — AND YOU CAN TRUST IT ═══════════════════════════════════ */}

    <Trust/>
    <WhatCounts/>

    {/* ═══ ARC 3 — AND IT REMEMBERS ══════════════════════════════════════ */}

    <LearnerTree/>
    <PracticeCard/>
    <ExamMode/>

    {/* ═══ ARC 4 — AND IT REPLACES YOUR STACK ════════════════════════════ */}

    <section id="notebook" className="notebook-section"><div className="story-container"><div className="section-topline"><div><div className="scene-eyebrow"><span>08</span> STILL YOUR NOTEBOOK</div><h2>All your notes.<br/><span className="muted-line">Not another subscription.</span></h2></div><div className="free-notes-aside"><span className="free-tag">FREE TO WRITE. ALWAYS.</span><p>Everything you need to take notes is free in Plumi: handwriting, folders, PDFs and your favourite tools. <span className="mobile-hide">If you know Goodnotes or Notability, you already know how it works.</span><b>Stop paying just to write.</b></p></div></div><NotebookGallery/><FocusBand/></div></section>

    <MechanicsStory/>

    <section id="your-course" className="memory-section story-container" aria-labelledby="memory-title"><div className="memory-copy"><div className="scene-eyebrow"><span>10</span> YOUR COURSE, NOT A SUBJECT</div><h2 id="memory-title">A fresh page.<br/><span className="muted-line">Not a fresh start.</span></h2><p>Plumi knows your specification and remembers the work you’ve done, so Home always has one honest next step waiting.</p><ul className="spec-chips" aria-label="Specifications Plumi knows">{specifications.map(s => <li key={s}>{s}</li>)}<li className="spec-more">{specificationsMore}</li></ul>
      {/* The unevenness, said out loud. Twelve trees, all A-Level, built by hand
          — and no GCSE specification in the app, which the app’s own
          `qualificationsOffered()` is careful about for the same reason. */}
      <p className="spec-note">{specificationNote}</p></div><div className="memory-proof"><div className="memory-loop" aria-label="Your work leads to evidence, then practice, then stronger understanding"><span>Your work</span><i>→</i><span>What it reveals</span><i>→</i><span>Your next step</span></div><figure><picture><source media="(max-width: 700px)" srcSet="/product/next-move-mobile.webp"/><img src="/product/next-move.webp" alt="Real Home recommendation: Electrical circuits. Still weak after four pieces of marked work. 12 minutes, 4 questions." width="1400" height="328" loading="lazy"/></picture><figcaption>One recommendation. Grounded in your actual work.</figcaption></figure></div></section>

    {/* ═══ ARC 5 — AND HERE IS THE DEAL ══════════════════════════════════ */}

    <section id="compare" className="compare-section story-container"><div className="compare-heading"><div className="scene-eyebrow"><span>11</span> A DIFFERENT WAY TO STUDY</div><h2>A chatbot sees what you paste.<br/><span className="muted-line">Plumi sees every attempt.</span></h2><p className="compare-lead">Four ways to get help with a question you can’t do. They are not the same thing.</p></div><Comparison/></section>

    <FreeAndPro/>
    <Faq/>

    <section id="close" className="community-section" data-testid="community-section"><div className="story-container community-layout"><div className="community-eyebrow">WRITE LIKE YOU ALWAYS HAVE.</div><h2 className="sr-only">Write like you always have. Find out what it proves.</h2><InkSignature/><div className="community-copy">
      {/* Promoted out of the footer. On a page whose only social proof is
          candour, this is the most trust-building sentence on the site and it
          was buried three scrolls below the last thing anybody reads. */}
      <p className="close-honesty">{footer.honesty}</p>
      <CtaButton placement="close" label="Join the Plumi community" size="large"/>
      <div className="close-notify"><p className="close-notify-label">Or just get one email on launch day.</p><LaunchNotify placement="close"/></div>
      <LaunchCountdown variant="footer"/>
    </div></div></section>

  </main><SiteFooter/><StickyCta/><SectionImpressions/></div>;
}
