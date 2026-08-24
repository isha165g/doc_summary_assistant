import React, { useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  X,
  FileCheck,
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
            title: 'File Size Exceeded',
            message: `"${rejection.file.name}" is ${(rejection.file.size / (1024 * 1024)).toFixed(
              1
            )}MB. Maximum allowed file size is 10MB.`,
          });
        } else if (error.code === 'file-invalid-type') {
          onError({
            status: 415,
            title: 'Unsupported Format',
            message: `"${rejection.file.name}" is not supported. Please provide a PDF document, PNG, or JPEG scan.`,
          });
        } else {
          onError({
            status: 400,
            title: 'Upload Validation Issue',
            message: error.message || 'The selected file could not be processed.',
          });
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        // Empty file check
        if (file.size === 0) {
          onError({
            status: 400,
            title: 'Empty Document',
            message: 'The selected file contains 0 bytes. Please provide a valid document.',
          });
          return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          onError({
            status: 413,
            title: 'File Size Exceeded',
            message: `The document exceeds the 10MB limit (${(file.size / (1024 * 1024)).toFixed(
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

  const isPdf =
    selectedFile?.name.toLowerCase().endsWith('.pdf') ||
    selectedFile?.type === 'application/pdf';

  return (
    <div className="space-y-3 w-full">
      {!selectedFile ? (
        <div
          {...getRootProps()}
          id="upload-dropzone"
          className={`dropzone relative group w-full p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 focus:outline-none border-2 border-dashed rounded flex flex-col items-center justify-center ${
            disabled
              ? 'opacity-40 cursor-not-allowed border-[var(--ink-faint)] bg-transparent'
              : isDragReject
              ? 'border-rose-500 bg-rose-950/20'
              : isDragActive
              ? 'border-[var(--accent)] bg-[var(--accent-subtle)] scale-[0.99]'
              : 'border-[var(--ink-faint)] bg-[var(--surface-subtle)] hover:border-[var(--accent)]'
          }`}
          style={{ minHeight: '220px' }}
        >
          <input {...(getInputProps() as any)} id="dropzone-input" />

          <div className="flex flex-col items-center justify-center pointer-events-none">
            <div className="dropzone-icon mb-4 text-[var(--accent)]">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 13v8M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242m-11-4L12 13l4-4" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>

            <p className="text-sm font-semibold tracking-wide uppercase text-[var(--ink)] mb-2">
              {isDragActive ? 'Release Document to Upload' : 'Choose Document or Drag & Drop'}
            </p>
            <p className="label-meta">PDF, PNG, JPEG &bull; MAX 10MB</p>
          </div>
        </div>
      ) : (
        /* Selected Inbound Document Slip */
        <div
          id="selected-file-card"
          className="rounded border border-[var(--accent)] bg-[var(--accent-subtle)] p-4 sm:p-5 transition-all animate-fadeIn"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded border border-[var(--accent)]/40 bg-[var(--bg)] flex items-center justify-center flex-shrink-0 text-[var(--accent)]">
                {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--ink)] truncate max-w-[220px] sm:max-w-md">
                    {selectedFile.name}
                  </p>
                  <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)] font-bold uppercase">
                    [ READY ]
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)] mt-1 font-mono-code">
                  <span>
                    {selectedFile.size > 1024 * 1024
                      ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                      : `${(selectedFile.size / 1024).toFixed(1)} KB`}
                  </span>
                  <span>&bull;</span>
                  <span>{isPdf ? 'PDF DOCUMENT' : 'IMAGE SCAN'}</span>
                </div>
              </div>
            </div>

            <button
              id="remove-file-button"
              type="button"
              onClick={handleRemoveFile}
              disabled={disabled}
              aria-label="Remove selected file"
              className="p-2 text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--ink-faint)] rounded border border-[var(--ink-faint)] transition-all focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50 min-w-[36px] min-h-[36px] flex items-center justify-center font-mono-code text-xs"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

