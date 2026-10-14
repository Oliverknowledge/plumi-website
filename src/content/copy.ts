/**
 * Allow-lists for the waitlist API.
 *
 * Everything else that used to live here (hero variants, scene copy, the old
 * FAQ) rendered nowhere and was removed on 14 October 2026. The live copy is in
 * src/content/home.ts, subjects.ts and landing.ts. What is left is only what
 * `src/app/api/waitlist/route.ts` checks a submitted subject and board against.
 */

export const waitlist = {
  subjects: ["Maths", "Physics", "Chemistry", "Biology", "Something else"],
  boards: ["AQA", "OCR", "Edexcel", "WJEC", "Not sure yet"],
} as const;
