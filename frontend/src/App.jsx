import { useState } from 'react';

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [summaryLength, setSummaryLength] = useState('medium');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Backend Health check state
  const [backendHealth, setBackendHealth] = useState(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // API URL resolution
  const rawApiUrl = import.meta.env.VITE_API_URL;
  const apiUrl = rawApiUrl || '';

  const handleFileChange = (e) => {
    setUploadError(null);
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleSummarize = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError({
        status: 400,
        message: 'Please select a document before clicking Summarize.',
      });
      return;
    }

    setIsSummarizing(true);
    setUploadError(null);
    setSummaryResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('length', summaryLength);

    const endpointsToTry = [];
    if (apiUrl) {
      endpointsToTry.push(`${apiUrl.replace(/\/$/, '')}/api/summarize`);
    }
    endpointsToTry.push('/api/summarize');

    let responseData = null;
    let requestSucceeded = false;
    let lastError = null;

    for (const endpoint of endpointsToTry) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          const errorMessage =
            data?.detail ||
            data?.message ||
            `Server returned ${response.status}: ${response.statusText}`;
          lastError = {
            status: response.status,
            message: errorMessage,
          };
          break; // Stop if the backend actually replied with an HTTP error
        } else {
          responseData = data;
          requestSucceeded = true;
          break;
        }
      } catch (err) {
        lastError = {
          status: 0,
          message: err.message || 'Failed to connect to backend server',
        };
      }
    }

    if (requestSucceeded && responseData) {
      setSummaryResult(responseData);
    } else {
      setUploadError(lastError || { status: 500, message: 'Unknown upload error' });
    }

    setIsSummarizing(false);
  };

  const checkBackendHealth = async () => {
    setIsCheckingHealth(true);
    setBackendHealth(null);

    const endpointsToTry = [];
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
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
          
          {/* Header */}
          <header className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 rounded-full mb-3 border border-blue-100">
              <span>Phase 2: File Upload Pipeline</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Document Summary Assistant
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Upload a PDF or image document to test the summarization pipeline contract
            </p>
          </header>

          {/* Form */}
          <form onSubmit={handleSummarize} className="space-y-6">
            
            {/* File Input */}
            <div className="space-y-2">
              <label 
                htmlFor="file-upload" 
                className="block text-sm font-semibold text-slate-700"
              >
                Upload Document
              </label>
              <div className="relative">
                <input
                  id="file-upload"
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  disabled={isSummarizing}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60"
                />
              </div>
              <p className="text-xs text-slate-500">
                Supported formats: <span className="font-medium text-slate-700">PDF, PNG, JPEG</span> &bull; Max file size: <span className="font-medium text-slate-700">10 MB</span>
              </p>

              {/* Selected File Details */}
              {selectedFile && (
                <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg p-3 mt-2">
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-700">Selected: </span>
                    <span className="font-mono text-slate-800">{selectedFile.name}</span>
                  </div>
                  <span className="whitespace-nowrap font-mono text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}
            </div>

            {/* Summary Length Dropdown */}
            <div className="space-y-2">
              <label 
                htmlFor="summary-length" 
                className="block text-sm font-semibold text-slate-700"
              >
                Summary Length
              </label>
              <select
                id="summary-length"
                value={summaryLength}
                onChange={(e) => setSummaryLength(e.target.value)}
                disabled={isSummarizing}
                className="block w-full rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 transition-all"
              >
                <option value="short">Short (Quick bullet highlights)</option>
                <option value="medium">Medium (Balanced overview — Default)</option>
                <option value="long">Long (Comprehensive in-depth summary)</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              id="summarize-submit-button"
              type="submit"
              disabled={isSummarizing || !selectedFile}
              className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-all focus:ring-4 focus:ring-blue-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSummarizing ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Summarize Document'
              )}
            </button>
          </form>

          {/* Error Display */}
          {uploadError && (
            <div
              id="upload-error-box"
              role="alert"
              className="mt-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-sm space-y-1 animate-fade-in"
            >
              <div className="flex items-center justify-between font-semibold">
                <span>Upload Failed</span>
                {uploadError.status > 0 && (
                  <span className="text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                    HTTP {uploadError.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-700">
                {uploadError.message}
              </p>
            </div>
          )}

          {/* Response Display */}
          {summaryResult && (
            <section
              id="summary-results-container"
              className="mt-8 pt-6 border-t border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">
                  Summary Result (Stubbed)
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                    {summaryResult.file_type}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-blue-50 text-blue-700 border border-blue-100">
                    {summaryResult.length}
                  </span>
                </div>
              </div>

              {/* Metadata row */}
              <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 font-mono">
                <div><strong className="text-slate-700">File:</strong> {summaryResult.filename}</div>
                <div><strong className="text-slate-700">Word Count:</strong> {summaryResult.word_count}</div>
              </div>

              {/* Summary Text Box */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Summary Overview
                </h3>
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-sm leading-relaxed">
                  {summaryResult.summary}
                </div>
              </div>

              {/* Key Points */}
              {summaryResult.key_points && summaryResult.key_points.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Key Points
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                    {summaryResult.key_points.map((point, index) => (
                      <li key={index} className="text-slate-700">
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Phase Note */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <span className="font-bold">&bull;</span>
                <p>
                  <strong>Phase 2 Contract Verified:</strong> The file upload and data contract are functioning end-to-end. Real PDF text extraction, OCR, and AI summarization models will be wired into this pipeline in Phase 3 & 4.
                </p>
              </div>
            </section>
          )}

          {/* Backend Connectivity Status Section */}
          <footer className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>Backend Endpoint:</span>
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                {apiUrl || 'Relative (/api)'}
              </code>
            </div>

            <button
              id="check-health-button"
              type="button"
              onClick={checkBackendHealth}
              disabled={isCheckingHealth}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition-colors"
            >
              {isCheckingHealth ? 'Testing...' : 'Test /api/health'}
            </button>
          </footer>

          {backendHealth && (
            <div className="mt-2 text-center text-xs">
              {backendHealth.status === 'ok' ? (
                <span className="text-emerald-700 font-medium">✓ Backend online (200 OK)</span>
              ) : (
                <span className="text-rose-600 font-medium">✗ {backendHealth.message}</span>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
