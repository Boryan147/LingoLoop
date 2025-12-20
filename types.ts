export enum Page {
  DASHBOARD = 'DASHBOARD',
  EXPRESSIONS = 'EXPRESSIONS',
  VISUAL_CONTEXT = 'VISUAL_CONTEXT',
  REVIEW = 'REVIEW',
}

export interface VocabularyItem {
  id: string;
  expression: string;
  definition: string;
  examples: string[];
  scenario: string;
  createdAt: number;
  
  // SRS Properties
  nextReviewDate: number; // Timestamp
  interval: number; // Days
  repetition: number;
  easeFactor: number;
}

export interface ImageAnalysisResult {
  narrative: string;
  vocabulary: string[];
}

export interface StudyStats {
  totalItems: number;
  itemsDue: number;
  retentionRate: number; // Simulated based on SRS status
  streak: number;
}
