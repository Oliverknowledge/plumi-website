"use client";

import { AppLink } from "@/components/studyapp/AppLink";
import { StreakChip } from "@/components/studyapp/StreakChip";
import { useNow } from "@/lib/studyapp/clock";
import type { DayFigures } from "@/lib/studyapp/dayStreak";
import { focusLine } from "@/lib/studyapp/focusLine";
import { clearFromSeat, useFromSeat } from "@/lib/studyapp/focusIntent";
import { subjectWord } from "@/lib/studyapp/library/subject";
import { compactFace, settled } from "@/lib/studyapp/timer";
import { useTimer, workedToday } from "@/lib/studyapp/timerStore";
import { todayLine } from "@/lib/studyapp/streak";
import { viewOf } from "../timer/TimerPanel";

/**
 * The quiet line under the Questions header: the day streak, what the focus session is doing (the clock is the chip's own, in plain text and not a live region, so a screen reader is never
 * read the seconds), what today has added up to, and a way back to the library if that is where they came from (leaving the library lets go of the seat, so it is the library it goes back to, not a seat). It is nothing at all while there is nothing true to say.
 */
export function QuestionsDay({ figures }: { figures: DayFigures }) {
  const { doc, ready } = useTimer();
  const now = useNow(1000);
  const fromSeat = useFromSeat(doc.session && !doc.session.isOver ? doc.session.id : null);
  if (!ready || !now) return null;
  const view = viewOf(doc.session, now);
  const running = doc.session && view !== "setup" ? settled(doc.session, now) : null;
  const focus = running ? focusLine(view, running.subject ? subjectWord(running.subject) : null, compactFace(running, now)) : null;
  const today = todayLine(workedToday(doc, now), figures.questions);
  const nudge = figures.streak === 0;
  const back = fromSeat && running !== null && view !== "over";
  const chip = figures.streak !== null && figures.streak > 0;
  if (!chip && !focus && !today && !nudge && !back) return null;
  return (
    <div className="qd-row" data-testid="qd-row">
      {chip && <StreakChip n={figures.streak} />}
      {focus && <span className="qd-focus" data-testid="focus-line">{focus}</span>}
      {today && <span className="qd-today" data-testid="today-line">{today}</span>}
      {nudge && !today && <span className="qd-today" data-testid="streak-nudge">Start a streak today</span>}
      {back && <AppLink href="/study/library" className="qs-link qd-back" onClick={clearFromSeat} data-testid="back-to-library">Back to the library</AppLink>}
    </div>
  );
}
