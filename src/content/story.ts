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
export const comparison = {
  alternatives: ["AI web tutor", "Private tutor", "Note-taking app"],
  rows: [
    { label: "Where you work", plumi: "Your handwritten page", others: ["Usually a separate conversation", "Together, in a session", "Your handwritten page"] },
    { label: "When you're stuck", plumi: "Tutoring, on the page", others: ["Ask for an explanation", "Personal, human guidance", "Usually a separate tool"] },
    { label: "What to study next", plumi: "Practice from your work", others: ["Depends on the platform", "Your tutor's judgement", "Usually up to you"] },
    { label: "What carries forward", plumi: "Evidence of your progress", others: ["Varies by platform", "What you share in sessions", "Your saved notes"] },
    { label: "How you access it", plumi: "Free notes. Optional Pro.", others: ["Free or subscription", "Typically paid per session", "Free or paid plans"] },
  ],
};
