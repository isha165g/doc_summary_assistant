import React from 'react';
import { AlertCircle, AlertTriangle, FileWarning, ServerCrash, X } from 'lucide-react';

export const ErrorBanner = ({ error, onDismiss }) => {
  if (!error) return null;

  const isWarning = error.status === 422;
  const isServer = error.status === 502 || error.status === 500;

  const getTitle = () => {
    if (error.title) return error.title;
    if (error.status === 413) return 'File Too Large';
    if (error.status === 415) return 'Unsupported File Format';
    if (error.status === 422) return 'No Readable Text Found';
    if (error.status === 502) return 'Summarization Service Busy';
    if (error.status === 400) return 'Upload Error';
    return 'Operation Failed';
  };

  const getIcon = () => {
    if (isWarning) return <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />;
    if (error.status === 413 || error.status === 415)
      return <FileWarning className="w-5 h-5 text-rose-600 flex-shrink-0" />;
    if (isServer) return <ServerCrash className="w-5 h-5 text-rose-600 flex-shrink-0" />;
    return <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />;
  };

  return (
    <div
      id="app-error-banner"
      role="alert"
      className={`rounded-xl border p-4 transition-all duration-200 animate-fadeIn ${
        isWarning
          ? 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-sm shadow-amber-100/50'
          : 'bg-rose-50/90 border-rose-200 text-rose-900 shadow-sm shadow-rose-100/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-tight">{getTitle()}</h3>
            {error.status !== undefined && error.status > 0 && (
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                  isWarning
                    ? 'bg-amber-100/80 text-amber-800 border-amber-300'
                    : 'bg-rose-100/80 text-rose-800 border-rose-300'
                }`}
              >
                HTTP {error.status}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-slate-700">{error.message}</p>
        </div>
        <button
          type="button"
          id="dismiss-error-button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className={`p-1.5 rounded-lg transition-colors -mr-1 -mt-1 ${
            isWarning
              ? 'text-amber-700 hover:bg-amber-100 focus:ring-2 focus:ring-amber-400'
              : 'text-rose-700 hover:bg-rose-100 focus:ring-2 focus:ring-rose-400'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ErrorBanner;
