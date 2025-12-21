import { VocabularyItem } from '../types';

const STORAGE_KEY = 'lingoloop_vocab';

export const getItems = (): VocabularyItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load items", e);
    return [];
  }
};

export const saveItem = (item: VocabularyItem) => {
  const items = getItems();
  items.push(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const updateItem = (updatedItem: VocabularyItem) => {
  const items = getItems();
  const index = items.findIndex(i => i.id === updatedItem.id);
  if (index !== -1) {
    items[index] = updatedItem;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
};

export const getDueItems = (): VocabularyItem[] => {
  const items = getItems();
  const now = Date.now();
  return items.filter(item => item.nextReviewDate <= now);
};

export const getStats = () => {
  const items = getItems();
  const due = items.filter(item => item.nextReviewDate <= Date.now()).length;
  // Simulated retention heuristic
  const totalRepetitions = items.reduce((acc, curr) => acc + curr.repetition, 0);
  const avgRetention = items.length ? Math.min(100, (totalRepetitions / (items.length * 5)) * 100) : 0;
  
  return {
    totalItems: items.length,
    itemsDue: due,
    retentionRate: Math.round(avgRetention),
    streak: 3 // Mock streak for demo
  };
};

// --- Backup & Restore Features ---

export const exportBackup = (): string => {
  return JSON.stringify(getItems(), null, 2);
};

export const importBackup = (jsonString: string): boolean => {
  try {
    const items = JSON.parse(jsonString);
    if (Array.isArray(items)) {
      // Basic validation to ensure it looks like our data
      const valid = items.every(i => i.id && i.expression && typeof i.repetition === 'number');
      if (valid) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error("Import failed", e);
    return false;
  }
};