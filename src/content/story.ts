// Real development captures only. The animation is not a live AI session.
// To replace the still sequence, put the final recording in public/product and set
// videoMp4/videoWebm. The same media container, pause control and poster remain.
export const tutorMedia: { videoMp4: string | null; videoWebm: string | null; poster: string } = {
  videoMp4: null, videoWebm: null, poster: "/product/tutor-5.webp",
};
export const tutorFrames = [
  { title: "Write naturally", detail: "Your handwriting. Your usual notebook.", alt: "Real Plumi notebook: the student writes the integral of e to the 2x, missing the factor one half." },
  { title: "Get a little nudge", detail: "A question, written right beside your work.", alt: "Plumi Tutor writes: What is the derivative of e to the 2x?" },
  { title: "Work it out together", detail: "You keep the pen. Plumi guides the next step.", alt: "The student writes 2e to the 2x in response to the Tutor's question." },
  { title: "Understand the why", detail: "A hint that helps the idea click.", alt: "Plumi confirms the derivative and asks what factor would undo it." },
  { title: "Make it stick", detail: "Then try another, while the idea is fresh.", alt: "The student answers one half. Plumi ticks it and offers another integral: e to the 3x." },
];
export const notebookViews = [
  { id: "library", label: "Your notebooks", image: "library", alt: "Real Plumi Library showing Maths exam and Untitled notebook, with subject navigation." },
  { id: "folders", label: "Your subjects", image: "folders", alt: "Real Plumi Physics folder containing Notes and Past papers." },
  { id: "notebook", label: "Your tools", image: "notebook", alt: "Real Plumi squared-paper notebook with pen, pencil, highlighter, eraser, lasso and AI Pen tools." },
];
// Specifications the app carries topic data for. Coverage is uneven; never claim "every board".
export const specifications = ["Edexcel Maths 9MA0", "AQA Chemistry 7405", "OCR Physics H556"];

export type Mark = { ok: boolean; note?: string };
const yes: Mark = { ok: true };
const no = (note?: string): Mark => ({ ok: false, note });
export const comparison = {
  alternatives: ["AI web tutor", "Private tutor", "Note-taking app"],
  rows: [
    { label: "Write naturally", plumi: yes, others: [no("Typed prompts and pasted photos"), yes, yes] },
    { label: "Tutor where you work", plumi: yes, others: [no("A separate chat tab"), yes, no()] },
    { label: "Learns from your actual work", plumi: yes, others: [no("Only what you paste in"), yes, no()] },
    { label: "Knows your specification", plumi: yes, others: [no("Usually general, not board-specific"), yes, no()] },
    { label: "Targeted practice", plumi: yes, others: [yes, yes, no()] },
    { label: "Remembers your weaknesses", plumi: yes, others: [no("Varies; often per conversation"), yes, no()] },
    { label: "Available whenever you study", plumi: yes, others: [yes, no("Booked sessions"), yes] },
    { label: "Notebook included", plumi: yes, others: [no(), no(), yes] },
  ],
};
