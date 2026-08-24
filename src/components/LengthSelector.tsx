import React from 'react';
import { SummaryLength } from '../types';
import { AlignLeft, FileText, AlignJustify } from 'lucide-react';

interface LengthSelectorProps {
  value: SummaryLength;
  onChange: (value: SummaryLength) => void;
  disabled?: boolean;
}

const LENGTH_OPTIONS: Array<{
  id: SummaryLength;
  label: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'short',
    label: 'Short',
    badge: '2-3 Sentences',
    description: 'Quick highlights for fast scanning',
    icon: AlignLeft,
  },
  {
    id: 'medium',
    label: 'Medium',
    badge: '5-6 Sentences',
    description: 'Balanced & structured overview (Recommended)',
    icon: FileText,
  },
  {
    id: 'long',
    label: 'Long',
    badge: '8-10 Sentences',
    description: 'Comprehensive deep dive summary',
    icon: AlignJustify,
  },
];

export const LengthSelector: React.FC<LengthSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="length-selector-group"
          className="text-xs font-semibold uppercase tracking-wider text-slate-700"
        >
          Summary Length
        </label>
        <span className="text-[11px] text-slate-500 font-medium">Select depth preset</span>
      </div>

      <div
        id="length-selector-group"
        role="radiogroup"
        aria-label="Summary Length"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
      >
        {LENGTH_OPTIONS.map((opt) => {
          const isSelected = value === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={`relative flex flex-col items-start p-3.5 rounded-xl border text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px] ${
                disabled
                  ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                  : isSelected
                  ? 'bg-indigo-50/80 border-indigo-600 ring-1 ring-indigo-600 shadow-sm'
                  : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isSelected ? 'text-indigo-600' : 'text-slate-500'
                    }`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      isSelected ? 'text-indigo-950' : 'text-slate-800'
                    }`}
                  >
                    {opt.label}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${
                    isSelected
                      ? 'bg-indigo-200/70 text-indigo-900 font-bold'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {opt.badge}
                </span>
              </div>
              <p
                className={`text-[11px] leading-tight ${
                  isSelected ? 'text-indigo-700 font-medium' : 'text-slate-500'
                }`}
              >
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
