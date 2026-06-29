import { VocabularyItem, StudyStats } from '../types';
import { supabase } from './supabase';
import { calculateAverageRetention } from './srs';

const STORAGE_KEY = 'lingoloop_vocab_v2';

export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const mapToSupabase = (item: VocabularyItem) => ({
  id: item.id,
  user_id: item.user_id,
  word_or_phrase: item.word_or_phrase,
  type: item.type,
  context_hint: item.context_hint,
  definition: item.definition,
  examples: item.examples || [],
  synonyms: item.synonyms || [],
  word_family: item.word_family || [],
  status: item.status,
  next_review_date: item.nextReviewDate,
  interval: item.interval,
  repetitions: item.repetitions,
  ease_factor: item.easeFactor,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});

const mapFromSupabase = (data: any): VocabularyItem => ({
  id: data.id,
  user_id: data.user_id,
  word_or_phrase: data.word_or_phrase || data.expression || '',
  type: data.type || 'ACTIVE',
  context_hint: data.context_hint || data.scenario || '',
  definition: data.definition || '',
  examples: data.examples || [],
  synonyms: data.synonyms || [],
  word_family: data.word_family || [],
  status: data.status || 'NEW',
  nextReviewDate: Number(data.next_review_date) || Date.now(),
  interval: typeof data.interval === 'number' ? data.interval : 0,
  repetitions: typeof data.repetitions === 'number' ? data.repetitions : (typeof data.repetition === 'number' ? data.repetition : 0),
  easeFactor: typeof data.ease_factor === 'number' ? data.ease_factor : 2.5,
  createdAt: Number(data.created_at) || Date.now(),
  updatedAt: Number(data.updated_at) || Date.now(),
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

export const toggleVocabularyType = async (itemId: string, currentType: 'ACTIVE' | 'PASSIVE', userId?: string) => {
  const newType = currentType === 'ACTIVE' ? 'PASSIVE' : 'ACTIVE';
  const now = Date.now();

  if (!userId) {
    const items = getLocalItems();
    const index = items.findIndex(i => i.id === itemId);
    if (index !== -1) {
      items[index] = { ...items[index], type: newType, updatedAt: now };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
    return;
  }

  try {
    const { error } = await supabase
      .from('vocabulary')
      .update({ type: newType, updated_at: now })
      .eq('id', itemId);

    if (error) {
      alert(`Toggle Type Error: ${error.message}`);
      throw error;
    }
  } catch (e) {
    console.error("Failed to toggle vocabulary type in Supabase", e);
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
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to sync local storage to Supabase", e);
  }
};

export const getStats = (items: VocabularyItem[]): StudyStats => {
  const due = items.filter(item => item.nextReviewDate <= Date.now()).length;
  const activeItems = items.filter(item => item.type === 'ACTIVE').length;
  const passiveItems = items.filter(item => item.type === 'PASSIVE').length;
  
  const avgRetention = calculateAverageRetention(items, 0);

  return {
    totalItems: items.length,
    activeItems,
    passiveItems,
    itemsDue: due,
    retentionRate: items.length ? Math.round(avgRetention * 100) : 100,
    streak: 3 // Mock streak for demo
  };
};

export const exportBackup = (items: VocabularyItem[]): string => {
  return JSON.stringify(items, null, 2);
};

export const importBackup = async (jsonString: string, userId?: string): Promise<boolean> => {
  try {
    const items = JSON.parse(jsonString);
    if (Array.isArray(items)) {
      const valid = items.every(i => i.id && i.word_or_phrase && typeof i.repetitions === 'number');
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