import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { SummaryResponse } from '../types';

interface SummaryResultProps {
  result: SummaryResponse;
  onReset: () => void;
}

export const SummaryResult: React.FC<SummaryResultProps> = ({ result, onReset }) => {
  const [copied, setCopied] = useState(false);

  const handleCopySummary = async () => {
    try {
      const textToCopy = `${result.summary}\n\nKey Takeaways:\n${result.key_points
        .map((p, i) => `${i + 1}. ${p}`)
        .join('\n')}`;

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = result.summary;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isPdf = result.file_type === 'pdf';

  return (
    <div
      id="summary-result-card"
      className="bg-[var(--surface-card)] rounded border border-[var(--ink-faint)] shadow-sm overflow-hidden animate-fadeIn space-y-6 p-6 sm:p-8 w-full"
    >
      {/* Top Manuscript Docket Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--ink-faint)]">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded border border-[var(--accent)] bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0 text-[var(--accent)]">
            {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <span className="label-meta block">03 / DOCUMENT SUMMARY</span>
            <h2 className="text-base sm:text-lg font-bold font-display uppercase tracking-tight text-[var(--ink)] truncate">
              {result.filename}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)] mt-1 font-mono-code">
              <span>{isPdf ? 'PDF DOCUMENT' : 'SCANNED IMAGE'}</span>
              <span>&bull;</span>
              <span className="text-[var(--accent)] font-semibold">
                {result.word_count} WORDS PARSED
              </span>
              <span>&bull;</span>
              <span className="uppercase px-1.5 py-0.5 rounded border border-[var(--ink-faint)] text-[var(--ink)]">
                {result.length} BRIEF
              </span>
            </div>
          </div>
        </div>

        {/* Action Button: Copy */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            id="copy-summary-button"
            onClick={handleCopySummary}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-mono-code uppercase font-semibold border transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] min-h-[38px] ${
              copied
                ? 'bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]'
                : 'bg-transparent hover:bg-[var(--surface-subtle)] text-[var(--ink)] border-[var(--ink-faint)] hover:border-[var(--ink-muted)]'
            }`}
            title="Copy summary & key points"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>[ COPIED_TO_CLIPBOARD ]</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                <span>[ COPY_TEXT ]</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Executive Summary Section */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="label-meta">EXECUTIVE SUMMARY</span>
        </div>
        <div
          id="summary-content-block"
          className="p-5 sm:p-6 bg-[var(--surface-subtle)] rounded border-l-4 border-l-[var(--accent)] border-y border-r border-[var(--ink-faint)]"
        >
          <p className="text-sm sm:text-base leading-relaxed text-[var(--ink)] whitespace-pre-line font-body">
            {result.summary}
          </p>
        </div>
      </div>

      {/* Key Takeaways Section */}
      {result.key_points && result.key_points.length > 0 && (
        <div className="space-y-3">
          <span className="label-meta">KEY TAKEAWAYS</span>
          <div className="grid grid-cols-1 gap-2.5">
            {result.key_points.map((point, index) => (
              <div
                key={index}
                className="flex items-start gap-3.5 p-3.5 sm:p-4 bg-[var(--surface-card)] rounded border border-[var(--ink-faint)] transition-colors hover:border-[var(--accent)] group"
              >
                <div className="mt-0.5 flex-shrink-0 font-mono-code text-xs font-bold text-[var(--accent)]">
                  [{String(index + 1).padStart(2, '0')}]
                </div>
                <p className="text-xs sm:text-sm text-[var(--ink)] leading-relaxed font-body">
                  {point}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer / Reset Action */}
      <div className="pt-4 border-t border-[var(--ink-faint)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 font-mono-code text-[11px] text-[var(--accent)]">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span>INFERENCE_COMPLETE &bull; GROQ LLaMA 3.3 70B</span>
        </div>

        <button
          type="button"
          id="summarize-another-button"
          onClick={onReset}
          className="btn-primary sm:w-auto px-5 py-2.5 text-xs font-display flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Summarize Another Document</span>
        </button>
      </div>
    </div>
  );
};


