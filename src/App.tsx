import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  Feather,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { UploadZone } from './components/UploadZone';
import { LengthSelector } from './components/LengthSelector';
import { LoadingState } from './components/LoadingState';
import { SummaryResult } from './components/SummaryResult';
import { ErrorBanner } from './components/ErrorBanner';
import { SummaryResponse, SummaryLength, AppError } from './types';

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summaryResult, setSummaryResult] = useState<SummaryResponse | null>(null);
  const [uploadError, setUploadError] = useState<AppError | null>(null);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Health check state
  const [backendHealth, setBackendHealth] = useState<{ status: string; message?: string } | null>(
    null
  );
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  const rawApiUrl = (import.meta as any).env?.VITE_API_URL;
  const apiUrl: string = rawApiUrl || '';

  const handleReset = () => {
    setSelectedFile(null);
    setSummaryResult(null);
    setUploadError(null);
    setIsSummarizing(false);
  };

  const handleSummarize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError({
        status: 400,
        title: 'No Manuscript Selected',
        message: 'Please provide a PDF document or scanned image to begin summarization.',
      });
      return;
    }

    setIsSummarizing(true);
    setUploadError(null);
    setSummaryResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('length', summaryLength);

    const endpointsToTry: string[] = [];
    if (apiUrl) {
      endpointsToTry.push(`${apiUrl.replace(/\/$/, '')}/api/summarize`);
    }
    endpointsToTry.push('/api/summarize');

    let responseData: SummaryResponse | null = null;
    let lastError: AppError | null = null;

    for (const endpoint of endpointsToTry) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          let errorMessage =
            data?.detail ||
            data?.message ||
            `Server returned HTTP ${response.status}`;

          if (response.status === 502) {
            errorMessage =
              "Could not generate a summary right now. Please verify service availability and try again.";
          } else if (response.status === 422) {
            errorMessage =
              data?.detail ||
              "No readable text found in this document. Please ensure the document is clear or contains extractable text.";
          }

          lastError = {
            status: response.status,
            message: errorMessage,
          };
          break;
        } else {
          responseData = data;
          break;
        }
      } catch (err: any) {
        lastError = {
          status: 0,
          title: 'Connection Error',
          message:
            err?.message ||
            'Failed to connect to the backend server. Please verify your connection or local proxy.',
        };
      }
    }

    if (responseData) {
      setSummaryResult(responseData);
    } else {
      setUploadError(
        lastError || {
          status: 500,
          title: 'Processing Failed',
          message: 'An unexpected error occurred while distilling your manuscript.',
        }
      );
    }

    setIsSummarizing(false);
  };

  const checkBackendHealth = async () => {
    setIsCheckingHealth(true);
    setBackendHealth(null);

    const endpointsToTry: string[] = [];
    if (apiUrl) {
      endpointsToTry.push(`${apiUrl.replace(/\/$/, '')}/api/health`);
    }
    endpointsToTry.push('/api/health');

    let succeeded = false;
    for (const endpoint of endpointsToTry) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setBackendHealth({ status: data.status || 'ok' });
          succeeded = true;
          break;
        }
      } catch {
        // try next endpoint
      }
    }

    if (!succeeded) {
      setBackendHealth({ status: 'error', message: 'Backend unreachable or offline' });
    }
    setIsCheckingHealth(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-between transition-colors duration-200 font-body">
      <main className="max-w-2xl w-full mx-auto space-y-6">
        {/* Header & Theme Toggle */}
        <header className="relative space-y-3 pt-2">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] font-display uppercase">
              Document Summary Assistant
            </h1>

            {/* Dark/Light Mode Toggle */}
            <button
              type="button"
              id="theme-toggle-button"
              onClick={toggleTheme}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--ink-faint)] bg-[var(--surface-card)] text-xs font-mono-code text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--accent)] transition-all focus:outline-none focus:ring-1 focus:ring-[var(--accent)] flex-shrink-0"
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>LIGHT</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>DARK</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs sm:text-sm text-[var(--ink-muted)] max-w-xl leading-relaxed">
            Summarize dense PDF reports, manuscripts, and scanned pages into clear, concise key points.
          </p>
        </header>

        {/* Dynamic State View */}
        {summaryResult ? (
          /* Result View */
          <SummaryResult result={summaryResult} onReset={handleReset} />
        ) : (
          /* Main Interactive Form Card */
          <div className="bg-[var(--surface-card)] rounded border border-[var(--ink-faint)] p-5 sm:p-8 space-y-6 shadow-sm">
            {/* Error Banner */}
            {uploadError && (
              <ErrorBanner error={uploadError} onDismiss={() => setUploadError(null)} />
            )}

            {isSummarizing ? (
              /* Loading Component */
              <LoadingState filename={selectedFile?.name} />
            ) : (
              /* Form */
              <form onSubmit={handleSummarize} className="space-y-6">
                {/* Drag-and-Drop Upload Zone */}
                <UploadZone
                  selectedFile={selectedFile}
                  onFileSelect={(file) => {
                    setSelectedFile(file);
                    setUploadError(null);
                  }}
                  onError={setUploadError}
                  disabled={isSummarizing}
                />

                {/* Length Preset Selector */}
                <LengthSelector
                  value={summaryLength}
                  onChange={setSummaryLength}
                  disabled={isSummarizing}
                />

                {/* Submit Action Button */}
                <button
                  id="summarize-submit-button"
                  type="submit"
                  disabled={isSummarizing || !selectedFile}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-4 px-6 text-sm font-display uppercase tracking-wider"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Summarize Document</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Footer Connectivity & Health Diagnostic */}
      <footer className="max-w-2xl w-full mx-auto mt-10 pt-6 border-t border-[var(--ink-faint)] text-xs text-[var(--ink-muted)] space-y-3 font-mono-code">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-2">
            <span>INFERENCE_ENDPOINT:</span>
            <code className="bg-[var(--surface-subtle)] px-2 py-0.5 rounded text-[var(--ink)] border border-[var(--ink-faint)]">
              {apiUrl || '/api (proxied)'}
            </code>
          </div>

          <button
            id="check-health-button"
            type="button"
            onClick={checkBackendHealth}
            disabled={isCheckingHealth}
            className="text-[11px] font-mono-code text-[var(--ink)] hover:text-[var(--accent)] bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] border border-[var(--ink-faint)] px-3 py-1.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            {isCheckingHealth ? '[ CHECKING... ]' : '[ DIAGNOSTIC_PING ]'}
          </button>
        </div>

        {backendHealth && (
          <div className="text-center sm:text-left text-xs pt-1">
            {backendHealth.status === 'ok' ? (
              <span className="text-[var(--accent)] font-semibold inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> [ STATUS: 200_OK &bull; PIPELINE_READY ]
              </span>
            ) : (
              <span className="text-rose-500 font-semibold inline-flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> [ STATUS: FAILED &bull; {backendHealth.message} ]
              </span>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}

