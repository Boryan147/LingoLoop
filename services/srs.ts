import { VocabularyItem } from '../types';

// Implementation of Spaced Repetition based on Ebbinghaus Forgetting Curve intervals
// The specific intervals (1d, 2d, 3d, 5d, 8d, 14d, 30d, 60d, 90d, 120d, 150d, 180d)
// aim to interrupt the forgetting process at critical drop-off points and ensure long-term retention.
const EBBINGHAUS_INTERVALS = [1, 2, 3, 5, 8, 14, 30, 60, 90, 120, 150, 180];

export const calculateNextReview = (
  item: VocabularyItem,
  quality: number // 1: Forgot, 2: Hard, 3: Good, 4: Easy
): Partial<VocabularyItem> => {
  let { repetitions, interval, easeFactor } = item;

  // Map user quality ratings (1-4) to SM-2 qualities (0-5)
  // 1 (Forgot) -> SM-2 quality 1 (Fail)
  // 2 (Hard) -> SM-2 quality 3 (Serious difficulty)
  // 3 (Good) -> SM-2 quality 4 (Hesitation)
  // 4 (Easy) -> SM-2 quality 5 (Perfect response)
  let smQuality = 0;
  if (quality === 1) smQuality = 1;
  else if (quality === 2) smQuality = 3;
  else if (quality === 3) smQuality = 4;
  else if (quality === 4) smQuality = 5;

  let nextStatus = item.status;

  if (smQuality >= 3) {
    // If successful review
    if (repetitions < EBBINGHAUS_INTERVALS.length) {
      // Use predefined Ebbinghaus intervals
      interval = EBBINGHAUS_INTERVALS[repetitions];
    } else {
      // Switch to standard SM-2 multiplier for long-term maintenance
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;

    // Transition status based on successful repetitions
    if (repetitions === 1) {
      nextStatus = 'LEARNING';
    } else if (repetitions === 2 || repetitions === 3) {
      nextStatus = 'REVIEW';
    } else if (repetitions >= 4) {
      nextStatus = 'MASTERED';
    }
  } else {
    // If failed review, reset to learning and reset interval/repetitions
    repetitions = 0;
    interval = 1;
    nextStatus = 'LEARNING';
  }

  // Adjust ease factor (standard SM-2 formula)
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - smQuality) * (0.08 + (5 - smQuality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReviewDate = Date.now() + interval * 24 * 60 * 60 * 1000;

  return {
    repetitions,
    interval,
    easeFactor,
    nextReviewDate,
    status: nextStatus,
  };
};

export const getInitialSRSState = () => ({
  repetitions: 0,
  interval: 0,
  easeFactor: 2.5,
  nextReviewDate: Date.now(), // Due immediately upon creation
  status: 'NEW' as const,
});

export const calculateItemRetention = (item: VocabularyItem, daysOffset: number = 0): number => {
  const now = Date.now() + daysOffset * 24 * 60 * 60 * 1000;
  
  // Memory stability (S) corresponds to the current review interval.
  // New items or items with 0 interval have a baseline stability of 0.5 days.
  const stability = item.interval > 0 ? item.interval : 0.5;

  // Last review time: nextReviewDate - interval
  const lastReview = item.interval > 0
    ? item.nextReviewDate - (item.interval * 24 * 60 * 60 * 1000)
    : item.createdAt;

  const elapsedDays = Math.max(0, (now - lastReview) / (24 * 60 * 60 * 1000));

  // Ebbinghaus Forgetting Curve formula: R = e^(-t / S)
  return Math.exp(-elapsedDays / stability);
};

export const calculateAverageRetention = (items: VocabularyItem[], daysOffset: number = 0): number => {
  if (items.length === 0) return 1.0;
  const total = items.reduce((acc, item) => acc + calculateItemRetention(item, daysOffset), 0);
  return total / items.length;
};