import React, { useEffect, useState } from 'react';
import { Loader2, FileSearch, BrainCircuit, Sparkles } from 'lucide-react';

const STATUS_STEPS = [
  {
    code: 'SYS_OCR_SCAN',
    message: 'Reading document layout & structure...',
    subtext: 'Scanning typography hierarchy and optical layers',
    icon: FileSearch,
  },
  {
    code: 'SYS_LAYER_EXTRACT',
    message: 'Extracting text layer & running OCR engine...',
    subtext: 'Resolving character matrices and bitmap channels',
    icon: Loader2,
  },
  {
    code: 'LLM_SUMMARIZE_GROQ',
    message: 'Generating document summary...',
    subtext: 'Summarizing core points and key takeaways via LLaMA 3.3',
    icon: BrainCircuit,
  },
  {
    code: 'SYS_FINAL_FORMAT',
    message: 'Finalizing key takeaways...',
    subtext: 'Polishing clarity, bullet points, and main highlights',
    icon: Sparkles,
  },
];

interface LoadingStateProps {
  filename?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ filename }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % STATUS_STEPS.length);
    }, 2400);

    return () => clearInterval(timer);
  }, []);

  const activeStep = STATUS_STEPS[currentStepIndex];
  const StepIcon = activeStep.icon;

  return (
    <div
      id="loading-state-card"
      className="p-6 sm:p-8 bg-[var(--surface-card)] rounded border border-[var(--accent)] shadow-sm space-y-6 animate-fadeIn w-full"
    >
      {/* Animated Icon and Message */}
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="relative">
          <div className="w-12 h-12 rounded border border-[var(--accent)] bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent)]">
            <StepIcon
              className={`w-6 h-6 ${
                StepIcon === Loader2 ? 'animate-spin' : 'animate-pulse'
              }`}
            />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent)]"></span>
          </span>
        </div>

        <div className="space-y-1.5">
          <span className="label-meta">{activeStep.code}</span>
          <h3 className="text-base font-bold font-display uppercase tracking-wide text-[var(--ink)]">
            {activeStep.message}
          </h3>
          <p className="text-xs text-[var(--ink-muted)] max-w-sm">
            {activeStep.subtext}
          </p>
          {filename && (
            <p className="text-[11px] font-mono-code text-[var(--ink-muted)] pt-1">
              TARGET: <span className="text-[var(--accent)] font-medium">{filename}</span>
            </p>
          )}
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-2 pt-1">
        {STATUS_STEPS.map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 rounded transition-all duration-300 ${
              idx === currentStepIndex
                ? 'w-10 bg-[var(--accent)]'
                : idx < currentStepIndex
                ? 'w-4 bg-[var(--accent)]/40'
                : 'w-4 bg-[var(--ink-faint)]'
            }`}
          />
        ))}
      </div>

      {/* Content Skeleton Placeholder */}
      <div className="space-y-2.5 pt-2 border-t border-[var(--ink-faint)]">
        <div className="h-3 bg-[var(--ink-faint)] rounded w-3/4 animate-pulse" />
        <div className="h-3 bg-[var(--ink-faint)] rounded w-full animate-pulse" />
        <div className="h-3 bg-[var(--ink-faint)] rounded w-5/6 animate-pulse" />
      </div>
    </div>
  );
};


