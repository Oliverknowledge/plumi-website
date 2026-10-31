// Render each piece of a worked solution's TeX with KaTeX, as the site does, and list any that fail.
// Reads [{ where, tex, display }] on stdin; prints [{ where, tex, error }] (empty when all render).
import katex from "katex";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const failures = [];
for (const job of JSON.parse(input)) {
  try {
    katex.renderToString(job.tex, { displayMode: job.display, throwOnError: true, strict: "error" });
  } catch (e) {
    failures.push({ where: job.where, tex: job.tex, error: String(e.message ?? e).slice(0, 200) });
  }
}
process.stdout.write(JSON.stringify(failures));
