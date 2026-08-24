import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, FileSearch, BrainCircuit } from 'lucide-react';

const STATUS_STEPS = [
  {
    message: 'Reading your document...',
    subtext: 'Inspecting document layout and scanning content',
    icon: FileSearch,
  },
  {
    message: 'Extracting text & running OCR...',
    subtext: 'Parsing digital typography and image stream layers',
    icon: Loader2,
  },
  {
    message: 'Generating AI summary & key takeaways...',
    subtext: 'Synthesizing concise highlights with high-speed intelligence',
    icon: BrainCircuit,
  },
  {
    message: 'Finalizing insights...',
    subtext: 'Polishing sentences and organizing key takeaway points',
    icon: Sparkles,
  },
];

export const LoadingState = ({ filename }) => {
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
      className="p-6 sm:p-8 bg-gradient-to-b from-indigo-50/60 to-white rounded-2xl border border-indigo-100 shadow-sm space-y-6 animate-fadeIn"
    >
      {/* Animated Icon and Message */}
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shadow-inner">
            <StepIcon
              className={`w-7 h-7 ${
                StepIcon === Loader2 ? 'animate-spin' : 'animate-pulse'
              }`}
            />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-600"></span>
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-800 tracking-tight transition-all duration-300">
            {activeStep.message}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm transition-all duration-300">
            {activeStep.subtext}
          </p>
          {filename && (
            <p className="text-[11px] font-mono text-slate-400 pt-1">
              File: <span className="text-slate-600 font-medium">{filename}</span>
            </p>
          )}
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-2 pt-1">
        {STATUS_STEPS.map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              idx === currentStepIndex
                ? 'w-8 bg-indigo-600'
                : idx < currentStepIndex
                ? 'w-3 bg-indigo-300'
                : 'w-3 bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* Content Skeleton Placeholder */}
      <div className="space-y-3 pt-2">
        <div className="h-4 bg-slate-200/70 rounded-md w-3/4 animate-pulse" />
        <div className="h-3.5 bg-slate-200/50 rounded-md w-full animate-pulse" />
        <div className="h-3.5 bg-slate-200/50 rounded-md w-5/6 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export default LoadingState;
