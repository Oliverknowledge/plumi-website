/** A pixel window's title bar: three dots and a label. A file of its own so the study app's Papers view wears the same window as the public past papers (Chrome.tsx re-exports it). */
export const WindowBar = ({ label }: { label: string }) => (
  <div className="lp-bar" aria-hidden="true"><i style={{ background: "#e0605a" }} /><i style={{ background: "#f2c96b" }} /><i style={{ background: "#8fb35a" }} /><span>{label}</span></div>
);
