export enum Page {
  DASHBOARD = 'DASHBOARD',
  EXPRESSIONS = 'EXPRESSIONS',
  VISUAL_CONTEXT = 'VISUAL_CONTEXT',
  REVIEW = 'REVIEW',
  SCENARIO = 'SCENARIO',
  SPEAKING = 'SPEAKING',
}

export interface Synonym {
  word: string;
  intensity: number;
  formality: number;
  nuance?: string;
}

export interface Collocations {
  verbs: string[];
  adjectives: string[];
}

export interface FeedbackResult {
  transcription: string;
  grammarCorrections: { original: string; corrected: string; explanation: string }[];
  vocabularyUpgrades: { word: string; suggestion: string; reason: string }[];
  nativeSuggestions: string[];
}

export interface VocabularyItem {
  id: string;
  expression: string;
  definition: string;
  partOfSpeech: string;
  phonetic: string;
  verbForms?: string;
  examples: string[];
  synonyms?: Synonym[];
  collocations?: Collocations;
  scenario: string;
  user_id?: string;
  createdAt: number;

  // SRS Properties
  nextReviewDate: number; // Timestamp
  interval: number; // Days
  repetition: number;
  easeFactor: number;
}

export interface Scenario {
  id: string;
  user_id: string;
  title: string;
  createdAt: number;
}

export interface ScenarioVocabularyItem extends Omit<VocabularyItem, 'scenario'> {
  scenario_id: string;
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
