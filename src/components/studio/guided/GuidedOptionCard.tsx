import type { ReactNode } from 'react';

export function GuidedOptionCard({
  type,
  name,
  value,
  checked,
  title,
  description,
  tone = 'neutral',
  onChange,
  detail,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  checked: boolean;
  title: string;
  description?: string;
  tone?: string;
  onChange: (checked: boolean) => void;
  detail?: ReactNode;
}) {
  return (
    <label className="guided-option-card" data-selected={checked} data-tone={tone}>
      <input
        className="guided-option-input"
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={event => onChange(event.currentTarget.checked)}
      />
      <span className="guided-option-art" aria-hidden="true"><i /><i /><i /></span>
      <span className="guided-option-copy">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
        {detail}
      </span>
      <span className="guided-option-mark" aria-hidden="true">{checked ? '✓' : ''}</span>
      <span className="sr-only">{checked ? 'انتخاب شده' : 'انتخاب نشده'}</span>
    </label>
  );
}
