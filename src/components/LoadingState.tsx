import React, { useEffect, useState } from 'react';
import {
  Loader2,
  FileSearch,
  BrainCircuit,
  Sparkles,
  FileText,
  Zap,
  Tag,
} from 'lucide-react';
import { StreamProgress } from '../types';

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
    code: 'SYS_CLASSIFY_DOC',
    message: 'Classifying document archetype...',
    subtext: 'Tailoring extraction & analysis parameters',
    icon: Tag,
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
  progress?: StreamProgress | null;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ filename, progress }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    // If we don't have real SSE progress, cycle periodically
    if (!progress) {
      const timer = setInterval(() => {
        setCurrentStepIndex((prev) => (prev + 1) % STATUS_STEPS.length);
      }, 2200);
      return () => clearInterval(timer);
    } else {
      // Map SSE stage to step index
      switch (progress.stage) {
        case 'validating':
          setCurrentStepIndex(0);
          break;
        case 'extracting':
          setCurrentStepIndex(1);
          break;
        case 'extracted':
        case 'classifying':
          setCurrentStepIndex(2);
          break;
        case 'summarizing':
          setCurrentStepIndex(3);
          break;
        case 'cached':
        case 'complete':
          setCurrentStepIndex(4);
          break;
      }
    }
  }, [progress]);

  const activeStep = STATUS_STEPS[currentStepIndex];
  const StepIcon = progress?.stage === 'cached' ? Zap : activeStep.icon;

  const displayMessage = progress?.message || activeStep.message;
  const displayCode = progress?.stage
    ? `STREAM_${progress.stage.toUpperCase()}`
    : activeStep.code;

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

        <div className="space-y-1.5 max-w-lg">
          <span className="label-meta inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            {displayCode}
          </span>
          <h3 className="text-base font-bold font-display uppercase tracking-wide text-[var(--ink)]">
            {displayMessage}
          </h3>

          {progress?.word_count ? (
            <p className="text-xs text-[var(--accent)] font-mono-code font-semibold">
              [ {progress.word_count.toLocaleString()} WORDS EXTRACTED &bull; PIPELINE ACTIVE ]
            </p>
          ) : (
            <p className="text-xs text-[var(--ink-muted)] max-w-sm mx-auto">
              {activeStep.subtext}
            </p>
          )}

          {filename && (
            <p className="text-[11px] font-mono-code text-[var(--ink-muted)] pt-1 truncate">
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
