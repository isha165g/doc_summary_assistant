import { useState } from 'react';

export default function App() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Backend API URL from environment variables or fallback
  const rawApiUrl = import.meta.env.VITE_API_URL;
  const apiUrl = rawApiUrl || '';

  const checkBackendHealth = async () => {
    setIsLoading(true);
    setErrorDetails(null);
    setBackendStatus(null);

    const endpointsToTry = [];
    if (apiUrl) {
      endpointsToTry.push(`${apiUrl.replace(/\/$/, '')}/api/health`);
    }
    endpointsToTry.push('/api/health');

    let lastError = null;
    let succeeded = false;

    for (const endpoint of endpointsToTry) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setBackendStatus(data.status || 'ok');
          succeeded = true;
          break;
        } else {
          lastError = new Error(`HTTP ${response.status} - ${response.statusText}`);
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!succeeded) {
      console.error('Failed to reach backend:', lastError);
      setBackendStatus('error');
      setErrorDetails(lastError?.message || 'Unable to connect to backend service');
    }
    setIsLoading(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <main className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        {/* Header */}
        <header className="mb-6 text-center">
          <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wide uppercase bg-blue-50 text-blue-700 rounded-full mb-2">
            Phase 1: Skeleton Scaffolding
          </span>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Document Summary Assistant
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload documents and verify backend connectivity
          </p>
        </header>

        {/* Card Body */}
        <div className="space-y-6">
          {/* File Input Section */}
          <section className="space-y-2">
            <label 
              htmlFor="document-file-input" 
              className="block text-sm font-medium text-slate-700"
            >
              Select Document (PDF / Image)
            </label>
            <input
              id="document-file-input"
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.png,.jpg,.jpeg"
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {selectedFile && (
              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2">
                <span className="font-semibold text-slate-700">Selected file:</span> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </section>

          {/* Backend Connectivity Section */}
          <section className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                Backend Connection
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {apiUrl}
              </span>
            </div>

            <button
              id="check-backend-button"
              type="button"
              onClick={checkBackendHealth}
              disabled={isLoading}
              className="w-full flex items-center justify-center py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-sm transition-colors focus:ring-2 focus:ring-slate-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Checking connection...
                </span>
              ) : (
                'Check backend'
              )}
            </button>

            {/* Status Display Area */}
            {backendStatus && (
              <div
                id="backend-status-display"
                className={`p-3.5 rounded-lg text-sm border flex flex-col gap-1 transition-all ${
                  backendStatus === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span>Backend status: {backendStatus}</span>
                  <span className="text-xs">
                    {backendStatus === 'ok' ? 'Online' : 'Offline / Unreachable'}
                  </span>
                </div>
                {backendStatus === 'ok' && (
                  <p className="text-xs text-emerald-700">
                    GET /api/health responded with 200 OK.
                  </p>
                )}
                {backendStatus === 'error' && errorDetails && (
                  <p className="text-xs text-rose-700 font-mono mt-0.5">
                    {errorDetails}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Phase 1 Deliverable &bull; FastAPI + React + Tailwind CSS
          </p>
        </footer>
      </main>
    </div>
  );
}
