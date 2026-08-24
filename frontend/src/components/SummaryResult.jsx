import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';

export const SummaryResult = ({ result, onReset }) => {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

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
      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden animate-fadeIn space-y-6 p-6 sm:p-8"
    >
      {/* Top Metadata Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
              isPdf
                ? 'bg-red-50 text-red-600 border border-red-200/80'
                : 'bg-blue-50 text-blue-600 border border-blue-200/80'
            }`}
          >
            {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate tracking-tight">
              {result.filename}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5 font-medium">
              <span className="capitalize">{isPdf ? 'PDF Document' : 'Image Scan'}</span>
              <span>&bull;</span>
              <span className="font-mono text-indigo-600 font-semibold">{result.word_count} words extracted</span>
              <span>&bull;</span>
              <span className="capitalize px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                {result.length} length
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Copy & Reset */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            id="copy-summary-button"
            onClick={handleCopySummary}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
            title="Copy summary & key points to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Summary</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary Section */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <span>Executive Summary</span>
        </div>
        <div
          id="summary-content-block"
          className="p-5 bg-gradient-to-br from-slate-50 to-indigo-50/20 rounded-xl border border-slate-200/80 text-slate-800 text-sm leading-relaxed text-justify sm:text-left"
        >
          <p className="whitespace-pre-line font-normal">{result.summary}</p>
        </div>
      </div>

      {/* Key Points Section */}
      {result.key_points && result.key_points.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Key Takeaways</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {result.key_points.map((point, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3.5 bg-slate-50/80 hover:bg-indigo-50/30 rounded-xl border border-slate-200/70 transition-colors"
              >
                <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-bold">
                  {index + 1}
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                  {point}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer / Reset Action */}
      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span>Extraction & AI Summary complete</span>
        </div>

        <button
          type="button"
          id="summarize-another-button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 min-h-[44px]"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Summarize Another Document</span>
        </button>
      </div>
    </div>
  );
};

export default SummaryResult;
