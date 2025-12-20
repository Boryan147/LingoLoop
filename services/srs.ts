import { VocabularyItem } from '../types';

// Implementation of Spaced Repetition based on Ebbinghaus Forgetting Curve intervals
// The specific intervals (1d, 2d, 6d, 31d) aim to interrupt the forgetting process at critical drop-off points.
const EBBINGHAUS_INTERVALS = [1, 2, 6, 31];

export const calculateNextReview = (
  item: VocabularyItem,
  quality: number // 0-5 rating. 0-2=fail, 3-5=pass
): Partial<VocabularyItem> => {
  let { repetition, interval, easeFactor } = item;

  if (quality >= 3) {
    // If successful review
    if (repetition < EBBINGHAUS_INTERVALS.length) {
      // Use predefined Ebbinghaus intervals
      interval = EBBINGHAUS_INTERVALS[repetition];
    } else {
      // Switch to standard SM-2 multiplier for long-term maintenance
      interval = Math.round(interval * easeFactor);
    }
    repetition += 1;
  } else {
    // If failed review, reset to start
    repetition = 0;
    interval = 1;
  }

  // Adjust ease factor (standard SM-2 formula)
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReviewDate = Date.now() + interval * 24 * 60 * 60 * 1000;

  return {
    repetition,
    interval,
    easeFactor,
    nextReviewDate,
  };
};

export const getInitialSRSState = () => ({
  repetition: 0,
  interval: 0,
  easeFactor: 2.5,
  nextReviewDate: Date.now(), // Due immediately upon creation
});