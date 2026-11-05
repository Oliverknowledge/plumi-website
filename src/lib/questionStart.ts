/**
 * Whether a part shows its question's setup ("How question 1 starts") before anyone asks. The setup is folded to keep a long list short,
 * but a first part is what the setup leads into, and a part this short has no words of its own to answer from: AQA's listening questions print
 * "01.1 Clara" and two boxes under one table of options, and a student reported that alone as a question cut off.
 * Taller later parts usually say what they need, so they stay folded with the button beside them.
 */
const SHORT = 0.15; // height over width: on a page 1086 wide, about two lines and the marks

export const startOpens = (at: number, part: { w: number; h: number }) => at === 0 || (part.w > 0 && part.h / part.w < SHORT);
