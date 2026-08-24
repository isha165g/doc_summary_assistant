import React from 'react';
import { SummaryLength } from '../types';

interface LengthSelectorProps {
  value: SummaryLength;
  onChange: (value: SummaryLength) => void;
  disabled?: boolean;
}

const LENGTH_OPTIONS: Array<{
  id: SummaryLength;
  meta: string;
  title: string;
  desc: string;
}> = [
  {
    id: 'short',
    meta: 'Concise Brief',
    title: '2-3 Sentences',
    desc: 'High-level synthesis for rapid review',
  },
  {
    id: 'medium',
    meta: 'Standard Overview',
    title: '5-6 Sentences',
    desc: 'Balanced editorial summary (Recommended)',
  },
  {
    id: 'long',
    meta: 'Deep Dive',
    title: '8-10 Sentences',
    desc: 'Thorough, multi-paragraph document digest',
  },
];

export const LengthSelector: React.FC<LengthSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-2">
      <span className="label-meta section-title block text-xs mb-2">01 / Configuration</span>

      <div
        id="length-selector-group"
        role="radiogroup"
        aria-label="Summary Length"
        className="grid grid-cols-1 gap-3"
      >
        {LENGTH_OPTIONS.map((opt) => {
          const isSelected = value === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={`option-card relative p-3.5 rounded text-left transition-all duration-200 border focus:outline-none focus:ring-1 focus:ring-[var(--accent)] min-h-[44px] ${
                disabled
                  ? 'opacity-40 cursor-not-allowed border-[var(--ink-faint)] bg-transparent'
                  : isSelected
                  ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                  : 'border-[var(--ink-faint)] bg-transparent hover:border-[var(--ink-muted)]/60'
              }`}
            >
              <span className="meta font-mono-code text-[0.65rem] text-[var(--accent)] font-semibold uppercase tracking-wider block mb-1">
                {opt.meta}
              </span>
              <span className="title text-sm font-semibold text-[var(--ink)] block mb-1">
                {opt.title}
              </span>
              <p className="desc text-xs text-[var(--ink-muted)] leading-relaxed">
                {opt.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};


