export type SummaryLength = 'short' | 'medium' | 'long';

export type FileType = 'pdf' | 'image';

export type DocumentType =
  | 'academic/research'
  | 'business/report'
  | 'legal/contract'
  | 'general/other';

export interface SummaryResponse {
  filename: string;
  file_type: FileType;
  length: SummaryLength;
  summary: string;
  key_points: string[];
  word_count: number;
  document_type?: DocumentType | string;
  cached?: boolean;
}

export interface StreamProgress {
  stage:
    | 'validating'
    | 'extracting'
    | 'extracted'
    | 'classifying'
    | 'summarizing'
    | 'cached'
    | 'complete'
    | 'error';
  message: string;
  word_count?: number;
  document_type?: string;
}

export interface AppError {
  status?: number;
  title?: string;
  message: string;
}
