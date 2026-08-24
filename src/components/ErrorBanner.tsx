import React from 'react';
import { AlertCircle, AlertTriangle, FileWarning, ServerCrash, X } from 'lucide-react';
import { AppError } from '../types';

interface ErrorBannerProps {
  error: AppError;
  onDismiss: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => {
  const isWarning = error.status === 422;
  const isServer = error.status === 502 || error.status === 500;

  const getTitle = () => {
    if (error.title) return error.title;
    if (error.status === 413) return 'FILE_SIZE_EXCEEDED';
    if (error.status === 415) return 'UNSUPPORTED_FORMAT';
    if (error.status === 422) return 'ZERO_TEXT_EXTRACTED';
    if (error.status === 502) return 'INFERENCE_SERVICE_BUSY';
    if (error.status === 400) return 'UPLOAD_INCOMPLETE';
    return 'PROCESSING_ERROR';
  };

  const getIcon = () => {
    if (isWarning) {
      return (
        <AlertTriangle className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
      );
    }
    if (error.status === 413 || error.status === 415) {
      return (
        <FileWarning className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
      );
    }
    if (isServer) {
      return (
        <ServerCrash className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
      );
    }
    return (
      <AlertCircle className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
    );
  };

  return (
    <div
      id="app-error-banner"
      role="alert"
      className="rounded border border-[var(--accent)] bg-[var(--accent-subtle)] p-4 transition-all duration-200 animate-fadeIn text-[var(--ink)] w-full"
    >
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono-code text-[var(--accent)]">
              [ERR] {getTitle()}
            </h3>
            {error.status !== undefined && error.status > 0 && (
              <span className="text-[10px] font-mono-code font-bold px-1.5 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)]">
                HTTP {error.status}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[var(--ink)] font-body">
            {error.message}
          </p>
        </div>
        <button
          type="button"
          id="dismiss-error-button"
          onClick={onDismiss}
          aria-label="Dismiss notice"
          className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--ink-faint)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};


