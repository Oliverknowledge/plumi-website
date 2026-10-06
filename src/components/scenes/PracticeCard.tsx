"use client";
import { useState } from "react";
import { MechanicsFigure } from "@/components/scenes/MechanicsStory";

export function PracticeCard() {
  const [answer, setAnswer] = useState(false);
  return <section id="practice" className="practice-section" data-testid="practice-section"><div className="story-container practice-layout">
    <div className="practice-copy"><h2>Your next question<br/><span className="muted-line">starts here.</span></h2><p>The weak branch becomes the next question.</p></div>
    <div className="practice-card" data-testid="practice-card">
      <div className="practice-card-head"><span className="next-card-kicker"><span className="small-blue-dot"/>NEXT · 8 MIN</span><strong>Resolving forces on inclined planes</strong></div>
      <div className="practice-figure"><MechanicsFigure theta={40} showForces={false}/></div>
      <div className="next-physics"><div className="next-topic">QUESTION 1 OF 3 · NORMAL REACTION</div><p>Same system. Now θ = 40°.<br/>What is the normal reaction?</p>{answer ? <div className="worked-answer" data-testid="mechanics-answer">R = 2 × 9.8 × cos 40° ≈ <b>15.0 N</b></div> : <button className="worked-reveal" data-testid="mechanics-reveal-answer" onClick={() => setAnswer(true)}>Reveal the worked step <span aria-hidden="true">↗</span></button>}</div>
      <p className="capture-caption">Illustrative practice card · Not an app recording</p>
    </div>
  </div></section>;
}
