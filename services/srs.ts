import { VocabularyItem } from '../types';

// Spaced Repetition Algorithm (Modified SM-2)
// Adjusts review frequency dynamically based on user familiarity (quality rating).
export const calculateNextReview = (
  item: VocabularyItem,
  quality: number // 1: Forgot, 2: Hard, 3: Good, 4: Easy
): Partial<VocabularyItem> => {
  let { repetitions, interval, easeFactor } = item;

  // Adjust easeFactor based on the quality response
  // 1 (Forgot): decrease ease factor significantly (-0.3)
  // 2 (Hard): decrease ease factor slightly (-0.15)
  // 3 (Good): maintain or slightly increase ease factor (+0.05)
  // 4 (Easy): increase ease factor (+0.15)
  let easeDelta = 0;
  if (quality === 1) easeDelta = -0.3;
  else if (quality === 2) easeDelta = -0.15;
  else if (quality === 3) easeDelta = 0.05;
  else if (quality === 4) easeDelta = 0.15;

  easeFactor = Math.max(1.3, Math.min(3.0, easeFactor + easeDelta));

  let nextStatus = item.status;

  if (quality === 1) {
    // Forgot: reset repetitions, set short interval (0.2 days = 4.8 hours) for quick re-review today
    repetitions = 0;
    interval = 0.2;
    nextStatus = 'LEARNING';
  } else {
    // Successful reviews (Hard, Good, Easy)
    if (repetitions === 0) {
      // First review
      if (quality === 2) interval = 1;      // Hard -> 1 day
      else if (quality === 3) interval = 2; // Good -> 2 days
      else interval = 4;                     // Easy -> 4 days
    } else if (repetitions === 1) {
      // Second review
      if (quality === 2) interval = 2;      // Hard -> 2 days
      else if (quality === 3) interval = 4; // Good -> 4 days
      else interval = 7;                     // Easy -> 7 days
    } else {
      // Subsequent reviews
      if (quality === 2) {
        // Hard: grows slowly (1.2x multiplier)
        interval = Math.max(1, Math.round(interval * 1.2));
      } else if (quality === 3) {
        // Good: grows at the standard easeFactor rate
        interval = Math.max(2, Math.round(interval * easeFactor));
      } else {
        // Easy: grows faster (1.5x of easeFactor rate) to reduce frequency
        interval = Math.max(3, Math.round(interval * easeFactor * 1.5));
      }
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
  }

  // Round interval to 2 decimal places to ensure clean values (e.g. 0.2)
  interval = Math.round(interval * 100) / 100;

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