import React, { useState } from 'react';

// A controlled <input type="number"> snaps straight back the moment you clear
// it — `Number('')` is 0, so the field refills itself and you can never delete
// the first digit to retype. This keeps a draft string while you are typing and
// only pushes real numbers upward; the draft is dropped on blur, so an empty or
// half-typed field falls back to the committed value instead of writing 0.
export default function NumberInput({ value, onChange, min, max, step, style, disabled, spinners = true }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  style?: React.CSSProperties;
  disabled?: boolean;
  spinners?: boolean;
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      type="number"
      disabled={disabled}
      // The spinner is a pseudo-element, so hiding it takes a class (see
      // globals.css) — an inline style cannot reach it.
      className={spinners ? undefined : 'lf-no-spin'}
      style={spinners ? style : { ...style, appearance: 'textfield', MozAppearance: 'textfield' } as React.CSSProperties}
      value={draft ?? String(value)}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        // '', '-', '.' and '-.' are all legitimate mid-typing states.
        if (raw !== '' && raw !== '-' && raw !== '.' && raw !== '-.' && !Number.isNaN(Number(raw))) {
          onChange(Number(raw));
        }
      }}
      onBlur={() => setDraft(null)}
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}
