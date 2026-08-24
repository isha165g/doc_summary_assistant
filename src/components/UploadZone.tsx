import React, { useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  X,
  FileCheck,
  FileType as FileTypeIcon,
} from 'lucide-react';
import { AppError } from '../types';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

interface UploadZoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onError: (error: AppError | null) => void;
  disabled?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  selectedFile,
  onFileSelect,
  onError,
  disabled = false,
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      onError(null);

      if (fileRejections.length > 0) {
        const rejection = fileRejections[0];
        const error = rejection.errors[0];

        if (error.code === 'file-too-large') {
          onError({
            status: 413,
            title: 'File Too Large',
            message: `"${rejection.file.name}" is ${(rejection.file.size / (1024 * 1024)).toFixed(
              1
            )}MB. Maximum allowed file size is 10MB.`,
          });
        } else if (error.code === 'file-invalid-type') {
          onError({
            status: 415,
            title: 'Unsupported File Format',
            message: `"${rejection.file.name}" is not supported. Please upload a PDF, PNG, or JPEG file.`,
          });
        } else {
          onError({
            status: 400,
            title: 'Upload Validation Error',
            message: error.message || 'The selected file could not be accepted.',
          });
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        // Additional sanity check
        if (file.size === 0) {
          onError({
            status: 400,
            title: 'Empty File',
            message: 'The selected file is empty (0 bytes). Please upload a valid document.',
          });
          return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          onError({
            status: 413,
            title: 'File Too Large',
            message: `The file exceeds the 10MB limit (${(file.size / (1024 * 1024)).toFixed(
              1
            )}MB).`,
          });
          return;
        }

        onFileSelect(file);
      }
    },
    [onFileSelect, onError]
  );

  const dropzoneOptions: any = {
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE_BYTES,
    multiple: false,
    disabled: disabled || !!selectedFile,
    noClick: !!selectedFile,
    noKeyboard: !!selectedFile,
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone(dropzoneOptions);

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    onError(null);
  };

  const isPdf = selectedFile?.name.toLowerCase().endsWith('.pdf') || selectedFile?.type === 'application/pdf';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="dropzone-input"
          className="text-xs font-semibold uppercase tracking-wider text-slate-700"
        >
          Document Upload
        </label>
        <span className="text-[11px] text-slate-500 font-medium">
          PDF, PNG, JPEG &bull; Up to 10MB
        </span>
      </div>

      {!selectedFile ? (
        <div
          {...getRootProps()}
          id="upload-dropzone"
          className={`relative group rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            disabled
              ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
              : isDragReject
              ? 'border-rose-400 bg-rose-50/60 ring-2 ring-rose-300'
              : isDragActive
              ? 'border-indigo-600 bg-indigo-50/70 scale-[0.99] shadow-inner ring-2 ring-indigo-200'
              : 'border-slate-300/80 bg-white hover:bg-slate-50/80 hover:border-indigo-400 shadow-sm'
          }`}
        >
          <input {...(getInputProps() as any)} id="dropzone-input" />

          <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
            {/* Upload Cloud Icon / Visual State */}
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                isDragActive
                  ? 'bg-indigo-600 text-white scale-110 shadow-md shadow-indigo-200'
                  : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 group-hover:scale-105'
              }`}
            >
              <UploadCloud className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                {isDragActive ? (
                  <span className="text-indigo-600">Drop your document here</span>
                ) : (
                  <>
                    <span className="text-indigo-600 hover:text-indigo-700">Click to browse</span>{' '}
                    <span className="text-slate-600 font-normal">or drag & drop</span>
                  </>
                )}
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Upload your PDF reports, scanned documents, receipts, or notes
              </p>
            </div>

            {/* Badges */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                <FileText className="w-3 h-3 text-red-500" /> PDF
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                <ImageIcon className="w-3 h-3 text-blue-500" /> PNG / JPG
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Selected File Card */
        <div
          id="selected-file-card"
          className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 transition-all animate-fadeIn shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  isPdf
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`}
              >
                {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-xs">
                    {selectedFile.name}
                  </p>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded uppercase bg-indigo-100/70 text-indigo-700 border border-indigo-200/60">
                    <FileCheck className="w-2.5 h-2.5" /> Ready
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-mono">
                    {selectedFile.size > 1024 * 1024
                      ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                      : `${(selectedFile.size / 1024).toFixed(1)} KB`}
                  </span>
                  <span>&bull;</span>
                  <span className="capitalize">{isPdf ? 'PDF Document' : 'Image Scan'}</span>
                </div>
              </div>
            </div>

            <button
              id="remove-file-button"
              type="button"
              onClick={handleRemoveFile}
              disabled={disabled}
              aria-label="Remove selected file"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-all focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-50"
              title="Remove file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
