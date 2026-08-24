export type SummaryLength = 'short' | 'medium' | 'long';

export type FileType = 'pdf' | 'image';

export interface SummaryResponse {
  filename: string;
  file_type: FileType;
  length: SummaryLength;
  summary: string;
  key_points: string[];
  word_count: number;
}

export interface AppError {
  status?: number;
  title?: string;
  message: string;
}
