import React, { useState } from 'react';
import { Sparkles, FileText, ArrowRight } from 'lucide-react';
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

  // Health check state
  const [backendHealth, setBackendHealth] = useState<{ status: string; message?: string } | null>(null);
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
        title: 'No File Selected',
        message: 'Please upload a PDF or image document before requesting a summary.',
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
            errorMessage = "Couldn't generate a summary right now. Please try again in a moment.";
          } else if (response.status === 422) {
            errorMessage =
              data?.detail ||
              "No readable text found in this document. Please try a clearer scan or a different file.";
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
          message: err?.message || 'Failed to connect to the backend server. Please verify your connection.',
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
          message: 'An unexpected error occurred while summarizing your document.',
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
      setBackendHealth({ status: 'error', message: 'Offline or unreachable' });
    }
    setIsCheckingHealth(false);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-between antialiased">
      <main className="max-w-2xl w-full mx-auto space-y-6">
        {/* Top Header */}
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200/60 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Document Intelligence</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Document Summary Assistant
          </h1>

          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Extract and summarize key takeaways from PDFs and scanned document images in seconds.
          </p>
        </header>

        {/* Dynamic State View */}
        {summaryResult ? (
          /* Result View */
          <SummaryResult result={summaryResult} onReset={handleReset} />
        ) : (
          /* Main Interactive Form Card */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5 sm:p-8 space-y-6">
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
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl text-sm transition-all focus:ring-4 focus:ring-indigo-100 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed shadow-sm min-h-[48px]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Extract & Summarize Document</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Footer Connectivity & Health Diagnostic */}
      <footer className="max-w-2xl w-full mx-auto mt-10 pt-6 border-t border-slate-200/80 text-xs text-slate-500 space-y-2">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-600">Backend API:</span>
            <code className="bg-slate-200/60 px-2 py-0.5 rounded text-slate-700 font-mono text-[11px]">
              {apiUrl || '/api (proxied)'}
            </code>
          </div>

          <button
            id="check-health-button"
            type="button"
            onClick={checkBackendHealth}
            disabled={isCheckingHealth}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {isCheckingHealth ? 'Testing connection...' : 'Test Backend Health'}
          </button>
        </div>

        {backendHealth && (
          <div className="text-center sm:text-left text-xs pt-1">
            {backendHealth.status === 'ok' ? (
              <span className="text-emerald-700 font-medium">✓ Backend online & ready (HTTP 200)</span>
            ) : (
              <span className="text-rose-600 font-medium">✗ {backendHealth.message}</span>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}
