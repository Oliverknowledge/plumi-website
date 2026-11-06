import { getAnswerImage } from "@/lib/studyapp/questions/answerImage";
import { MAX_PICTURE_CHARS } from "./api";

/**
 * The student's handwritten answer to one part, as a small JPEG for Plumi to read (browser only). It is drawn from the stored strokes
 * (answerImage.ts), cropped to the writing, then shrunk to at most MAX_SIDE pixels and re-encoded, so it stays far under the server's
 * limit whatever the size of the screen or the amount of writing. Null when there is no ink or the browser cannot draw it.
 */
const MAX_SIDE = 1500;

export async function answerPicture(partId: string, setId: string): Promise<string | null> {
  const png = await getAnswerImage(partId, { setId, scale: 1.5 });
  if (!png || typeof document === "undefined") return null;
  const img = new Image();
  await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(new Error("image")); img.src = png; });
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * k));
  canvas.height = Math.max(1, Math.round(img.height * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const q of [0.88, 0.75, 0.6, 0.45]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= MAX_PICTURE_CHARS) return url;
  }
  return null;
}
