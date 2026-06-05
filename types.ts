export enum Page {
  DASHBOARD = 'DASHBOARD',
  CAPTURE = 'CAPTURE',
  REVIEW = 'REVIEW',
}

export type VocabularyType = 'ACTIVE' | 'PASSIVE';
export type VocabularyStatus = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED';

export interface VocabularyItem {
  id: string;
  user_id?: string;
  word_or_phrase: string;
  type: VocabularyType;
  context_hint: string;
  definition: string;
  status: VocabularyStatus;

  // SRS Properties
  nextReviewDate: number; // Timestamp
  interval: number; // Days
  repetitions: number;
  easeFactor: number;

  createdAt: number;
  updatedAt: number;
}

export interface StudyStats {
  totalItems: number;
  activeItems: number;
  passiveItems: number;
  itemsDue: number;
  retentionRate: number; // Simulated based on SRS status
  streak: number;
}
