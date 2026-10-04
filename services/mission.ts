import { DailyLog, VocabularyItem, VocabularyType } from '../types';
import { calculateItemRetention } from './srs';

// Daily mission: a small fixed amount of review with a clear finish line.
// Anything beyond it is an optional bonus round.
export const DAILY_ACTIVE_GOAL = 5;
export const DAILY_PASSIVE_GOAL = 5;
export const BONUS_ROUND_SIZE = 5;
// Cap on never-reviewed words per round, so new captures trickle in instead of flooding the queue
export const MAX_NEW_PER_ROUND = 2;
// One missed day per rolling window of this many days is forgiven
export const FREE_MISS_WINDOW_DAYS = 7;

export type RoundKind = 'MISSION' | 'BONUS_ACTIVE' | 'BONUS_PASSIVE';

export const toDayKey = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const shiftDayKey = (dayKey: string, days: number): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return toDayKey(new Date(y, m - 1, d + days));
};

export const emptyLog = (day: string): DailyLog => ({
  day,
  active_reviewed: 0,
  passive_reviewed: 0,
  goal_met: false,
});

export const findLog = (logs: DailyLog[], day: string): DailyLog =>
  logs.find(l => l.day === day) || emptyLog(day);

const countDue = (items: VocabularyItem[], type: VocabularyType, now: number) =>
  items.filter(i => i.type === type && i.nextReviewDate <= now).length;

// Picks the due words most at risk of being forgotten, mixing in at most MAX_NEW_PER_ROUND new words
export const pickRound = (
  items: VocabularyItem[],
  type: VocabularyType,
  count: number,
  now: number = Date.now()
): VocabularyItem[] => {
  if (count <= 0) return [];
  const due = items.filter(i => i.type === type && i.nextReviewDate <= now);

  const fresh = due
    .filter(i => i.status === 'NEW')
    .sort((a, b) => a.createdAt - b.createdAt);
  const seen = due
    .filter(i => i.status !== 'NEW')
    .map(item => ({ item, retention: calculateItemRetention(item) }))
    .sort((a, b) => a.retention - b.retention || a.item.nextReviewDate - b.item.nextReviewDate)
    .map(entry => entry.item);

  const newCount = Math.min(fresh.length, MAX_NEW_PER_ROUND, count);
  const picked = [...seen.slice(0, count - newCount), ...fresh.slice(0, newCount)];
  // Not enough previously-seen words to fill the round: top up with more new ones
  if (picked.length < count) {
    picked.push(...fresh.slice(newCount, newCount + count - picked.length));
  }
  return picked;
};

export interface MissionStatus {
  activeDone: number;
  activeTarget: number;
  passiveDone: number;
  passiveTarget: number;
  done: number;
  target: number;
  isComplete: boolean;
  dueActive: number;
  duePassive: number;
}

export const getMissionStatus = (
  items: VocabularyItem[],
  log: DailyLog,
  now: number = Date.now()
): MissionStatus => {
  const dueActive = countDue(items, 'ACTIVE', now);
  const duePassive = countDue(items, 'PASSIVE', now);

  // The goal shrinks when fewer words are due, so a light day can still be finished
  const activeTarget = Math.min(DAILY_ACTIVE_GOAL, log.active_reviewed + dueActive);
  const passiveTarget = Math.min(DAILY_PASSIVE_GOAL, log.passive_reviewed + duePassive);
  const activeDone = Math.min(log.active_reviewed, activeTarget);
  const passiveDone = Math.min(log.passive_reviewed, passiveTarget);

  return {
    activeDone,
    activeTarget,
    passiveDone,
    passiveTarget,
    done: activeDone + passiveDone,
    target: activeTarget + passiveTarget,
    isComplete: log.goal_met || (activeDone >= activeTarget && passiveDone >= passiveTarget),
    dueActive,
    duePassive,
  };
};

// True when today's mission is finished but not yet persisted as met
export const shouldMarkGoalMet = (items: VocabularyItem[], log: DailyLog): boolean =>
  items.length > 0 && !log.goal_met && getMissionStatus(items, log).isComplete;

export const buildRound = (
  kind: RoundKind,
  items: VocabularyItem[],
  todayLog: DailyLog
): { active: VocabularyItem[]; passive: VocabularyItem[] } | null => {
  let active: VocabularyItem[] = [];
  let passive: VocabularyItem[] = [];

  if (kind === 'MISSION') {
    const status = getMissionStatus(items, todayLog);
    if (status.isComplete) return null;
    active = pickRound(items, 'ACTIVE', status.activeTarget - status.activeDone);
    passive = pickRound(items, 'PASSIVE', status.passiveTarget - status.passiveDone);
  } else if (kind === 'BONUS_ACTIVE') {
    active = pickRound(items, 'ACTIVE', BONUS_ROUND_SIZE);
  } else {
    passive = pickRound(items, 'PASSIVE', BONUS_ROUND_SIZE);
  }

  return active.length > 0 || passive.length > 0 ? { active, passive } : null;
};

export interface StreakInfo {
  current: number; // Completed days in the current run (forgiven days keep it alive but don't add to it)
  todayMet: boolean;
  frozenDays: Set<string>; // Missed days forgiven by the free miss
  freeMissReadyOn: string | null; // null when a free miss is available right now
}

export const computeStreak = (logs: DailyLog[], today: string = toDayKey()): StreakInfo => {
  const metDays = new Set(logs.filter(l => l.goal_met).map(l => l.day));
  const firstDay = logs.reduce((min, l) => (l.day < min ? l.day : min), today);
  const todayMet = metDays.has(today);

  let current = 0;
  let oldestMetDay: string | null = null;
  let lastFrozenOffset: number | null = null;
  const frozen: string[] = [];

  // An unfinished today doesn't break the streak yet, so start counting from yesterday
  for (let offset = todayMet ? 0 : 1; ; offset++) {
    const day = shiftDayKey(today, -offset);
    if (day < firstDay) break;
    if (metDays.has(day)) {
      current++;
      oldestMetDay = day;
      continue;
    }
    if (lastFrozenOffset === null || offset - lastFrozenOffset >= FREE_MISS_WINDOW_DAYS) {
      frozen.push(day);
      lastFrozenOffset = offset;
      continue;
    }
    break;
  }

  // Forgiven days older than the run's first completed day weren't protecting anything
  const frozenDays = new Set(frozen.filter(d => oldestMetDay !== null && d > oldestMetDay));

  const windowStart = shiftDayKey(today, -(FREE_MISS_WINDOW_DAYS - 1));
  const recentFreeze = [...frozenDays].filter(d => d >= windowStart).sort().pop();
  const freeMissReadyOn = recentFreeze ? shiftDayKey(recentFreeze, FREE_MISS_WINDOW_DAYS) : null;

  return { current, todayMet, frozenDays, freeMissReadyOn };
};
