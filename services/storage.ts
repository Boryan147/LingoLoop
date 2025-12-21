import { VocabularyItem } from '../types';
import { supabase } from './supabase';

const STORAGE_KEY = 'lingoloop_vocab';

export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Robust UUID v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const mapToSupabase = (item: VocabularyItem) => ({
  id: item.id,
  user_id: item.user_id,
  expression: item.expression,
  definition: item.definition,
  examples: item.examples,
  scenario: item.scenario,
  created_at: item.createdAt,
  next_review_date: item.nextReviewDate,
  interval: item.interval,
  repetition: item.repetition,
  ease_factor: item.easeFactor,
});

const mapFromSupabase = (data: any): VocabularyItem => ({
  id: data.id,
  user_id: data.user_id,
  expression: data.expression,
  definition: data.definition,
  examples: data.examples,
  scenario: data.scenario,
  createdAt: Number(data.created_at),
  nextReviewDate: Number(data.next_review_date),
  interval: data.interval,
  repetition: data.repetition,
  easeFactor: data.ease_factor,
});

// --- Local Storage Fallback ---
export const getLocalItems = (): VocabularyItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load local items", e);
    return [];
  }
};

export const saveLocalItem = (item: VocabularyItem) => {
  const items = getLocalItems();
  items.push(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

// --- Supabase Storage ---
export const getItems = async (userId?: string): Promise<VocabularyItem[]> => {
  if (!userId) {
    return getLocalItems();
  }

  try {
    const { data, error } = await supabase
      .from('vocabulary')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapFromSupabase);
  } catch (e) {
    console.error("Failed to load items from Supabase", e);
    return getLocalItems();
  }
};

export const saveItem = async (item: VocabularyItem, userId?: string) => {
  if (!userId) {
    saveLocalItem(item);
    return;
  }

  try {
    const payload = mapToSupabase({ ...item, user_id: userId });
    const { error } = await supabase
      .from('vocabulary')
      .upsert([payload], { onConflict: 'id' });

    if (error) {
      alert(`Sync Error: ${error.message}`);
      throw error;
    }
  } catch (e) {
    console.error("Failed to save item to Supabase", e);
    // Keep local as fallback but notify
    saveLocalItem(item);
  }
};

export const updateItem = async (updatedItem: VocabularyItem, userId?: string) => {
  if (!userId) {
    const items = getLocalItems();
    const index = items.findIndex(i => i.id === updatedItem.id);
    if (index !== -1) {
      items[index] = updatedItem;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
    return;
  }

  try {
    const payload = mapToSupabase({ ...updatedItem, user_id: userId });
    const { error } = await supabase
      .from('vocabulary')
      .upsert([payload], { onConflict: 'id' });

    if (error) {
      alert(`Update Error: ${error.message}`);
      throw error;
    }
  } catch (e) {
    console.error("Failed to update item in Supabase", e);
  }
};

export const deleteItem = async (itemId: string, userId?: string) => {
  if (!userId) {
    const items = getLocalItems();
    const filteredItems = items.filter(i => i.id !== itemId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredItems));
    return;
  }

  try {
    const { error } = await supabase
      .from('vocabulary')
      .delete()
      .eq('id', itemId);

    if (error) {
      alert(`Delete Error: ${error.message}`);
      throw error;
    }
  } catch (e) {
    console.error("Failed to delete item from Supabase", e);
  }
};

export const syncLocalStorageToSupabase = async (userId: string) => {
  const localItems = getLocalItems();
  if (localItems.length === 0) return;

  try {
    const itemsWithUserId = localItems.map(item => mapToSupabase({
      ...item,
      user_id: userId
    }));

    const { error } = await supabase
      .from('vocabulary')
      .upsert(itemsWithUserId, { onConflict: 'id' });

    if (error) throw error;

    // Clear local storage after successful sync
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to sync local storage to Supabase", e);
  }
};

export const getStats = (items: VocabularyItem[]) => {
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

export const exportBackup = (items: VocabularyItem[]): string => {
  return JSON.stringify(items, null, 2);
};

export const importBackup = async (jsonString: string, userId?: string): Promise<boolean> => {
  try {
    const items = JSON.parse(jsonString);
    if (Array.isArray(items)) {
      const valid = items.every(i => i.id && i.expression && typeof i.repetition === 'number');
      if (valid) {
        if (userId) {
          const itemsWithUserId = items.map(item => mapToSupabase({ ...item, user_id: userId }));
          const { error } = await supabase.from('vocabulary').upsert(itemsWithUserId);
          return !error;
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
          return true;
        }
      }
    }
    return false;
  } catch (e) {
    console.error("Import failed", e);
    return false;
  }
};