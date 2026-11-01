/**
 * One line on the Desk each day. Short, real, and attributed; chosen by the day so it does not change
 * on every refresh. (Laozi's is the founder's own from the design.)
 */
export const QUOTES: readonly { text: string; by: string }[] = [
  { text: "A journey of a thousand miles begins with a single step.", by: "Laozi" },
  { text: "It always seems impossible until it is done.", by: "Nelson Mandela" },
  { text: "The expert in anything was once a beginner.", by: "Helen Hayes" },
  { text: "Well begun is half done.", by: "Aristotle" },
  { text: "What we learn with pleasure we never forget.", by: "Alfred Mercier" },
  { text: "You don’t have to be great to start, but you have to start to be great.", by: "Zig Ziglar" },
  { text: "The beautiful thing about learning is that nobody can take it away from you.", by: "B. B. King" },
  { text: "Small steps every day.", by: "Plumi" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", by: "Thomas Edison" },
  { text: "It does not matter how slowly you go as long as you do not stop.", by: "Confucius" },
];

export function quoteFor(dayISO: string) {
  let h = 0;
  for (const c of dayISO) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return QUOTES[h % QUOTES.length];
}
