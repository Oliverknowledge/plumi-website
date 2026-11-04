/**
 * Lines said in the same moment ("An old set was removed to make room." and "First 60 questions", both from one tap on Practise) are joined into ONE calm message (one line each), in the
 * order they were said, so the single-slot toaster never drops the first. Said twice, a line is said once.
 */
export function makeToastQueue(flush: (message: string) => void, schedule: (run: () => void) => void = (f) => queueMicrotask(f)): (message: string) => void {
  let buf: string[] = [];
  return (message) => {
    if (!message || buf.includes(message)) return;
    buf.push(message);
    if (buf.length === 1) schedule(() => { const all = buf.join("\n"); buf = []; flush(all); });
  };
}
