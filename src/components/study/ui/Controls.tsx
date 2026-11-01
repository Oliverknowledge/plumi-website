import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { PixelIcon, type PixelIconName } from "./PixelIcon";

const join = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * One option of a single-choice group: off is a card with a line, on is filled with the
 * line colour. State is carried by `aria-pressed`, so a screen reader hears it too.
 */
export function Chip({
  selected, small, swatch, children, className, ...rest
}: {
  selected?: boolean;
  /** A 36px option toggle (its hit area is still 44px). */
  small?: boolean;
  /** A subject colour square before the label. */
  swatch?: string;
  children: ReactNode;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button type="button" className={join("st-chip", small && "st-chip--sm", className)} aria-pressed={!!selected} {...rest}>
      {swatch && <span className="st-swatch" data-subject={swatch} aria-hidden="true" />}
      {children}
    </button>
  );
}

/** A row of chips where exactly one is on. */
export function Segmented<T extends string>({
  label, value, onChange, options, fill,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: string }[];
  /** Stretch the chips across the row. */
  fill?: boolean;
}) {
  return (
    <div className={join("st-seg", fill && "st-seg--fill")} role="group" aria-label={label}>
      {options.map((o) => (
        <Chip key={o.value} selected={o.value === value} onClick={() => onChange(o.value)}>{o.label}</Chip>
      ))}
    </div>
  );
}

/** A square switch. Green is "on", never "correct". */
export function Switch({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="st-switch"
      onClick={() => onChange(!checked)}
    />
  );
}

/** A labelled text field. Free text is Nunito, so a student's own words stay readable. */
export function TextField({
  label, hint, error, icon, code, className, ...rest
}: {
  label?: string;
  hint?: string;
  error?: string;
  icon?: PixelIconName;
  /** A short code (a join code): set in pixel type. */
  code?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="st-eyebrow st-label">{label}</label>}
      <div className={join("st-field", code && "st-field--code", error && "st-field--error")}>
        {icon && <PixelIcon name={icon} size={16} />}
        <input id={id} aria-invalid={error ? true : undefined} aria-describedby={note ? `${id}-note` : undefined} {...rest} />
      </div>
      {note && <div id={`${id}-note`} className={join("st-hint", error && "st-hint--error")}>{note}</div>}
    </div>
  );
}

export function TextArea({
  label, hint, className, ...rest
}: { label?: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="st-eyebrow st-label">{label}</label>}
      <div className="st-field"><textarea id={id} aria-describedby={hint ? `${id}-note` : undefined} {...rest} /></div>
      {hint && <div id={`${id}-note`} className="st-hint">{hint}</div>}
    </div>
  );
}

/** Subject tabs: the chosen one is raised and larger, the rest sit flat. */
export function Tabs<T extends string>({
  label, value, onChange, tabs,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  tabs: readonly { value: T; label: string; subject?: string }[];
}) {
  return (
    <div className="st-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          className="st-tab"
          onClick={() => onChange(t.value)}
        >
          {t.subject && <span className="st-swatch" data-subject={t.subject} aria-hidden="true" />}
          {t.label}
        </button>
      ))}
    </div>
  );
}
