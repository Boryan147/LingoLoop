import { VocabularyItem, Scenario, ScenarioVocabularyItem } from '../types';
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
  part_of_speech: item.partOfSpeech,
  phonetic: item.phonetic,
  verb_forms: item.verbForms,
  examples: item.examples,
  synonyms: item.synonyms,
  collocations: item.collocations,
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
  partOfSpeech: data.part_of_speech || '',
  phonetic: data.phonetic || '',
  verbForms: data.verb_forms,
  examples: data.examples,
  synonyms: data.synonyms,
  collocations: data.collocations,
  scenario: data.scenario,
  createdAt: Number(data.created_at),
  nextReviewDate: Number(data.next_review_date),
  interval: data.interval,
  repetition: data.repetition,
  easeFactor: data.ease_factor,
});

const mapScenarioFromSupabase = (data: any): Scenario => ({
  id: data.id,
  user_id: data.user_id,
  title: data.title,
  createdAt: Number(data.created_at),
});

const mapScenarioVocabToSupabase = (item: ScenarioVocabularyItem) => ({
  ...mapToSupabase({ ...item, scenario: '' } as any),
  scenario_id: item.scenario_id,
});

// Helper to remove extra fields that don't belong in scenario_vocabulary
const cleanScenarioVocabPayload = (payload: any) => {
  const { scenario, ...rest } = payload;
  return rest;
};

const mapScenarioVocabFromSupabase = (data: any): ScenarioVocabularyItem => {
  const { scenario, ...item } = mapFromSupabase(data);
  return {
    ...item,
    scenario_id: data.scenario_id,
  };
};

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

// --- Scenario Storage ---

export const getScenarios = async (userId: string): Promise<Scenario[]> => {
  try {
    const { data, error } = await supabase
      .from('scenarios')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapScenarioFromSupabase);
  } catch (e) {
    console.error("Failed to load scenarios", e);
    return [];
  }
};

export const getScenarioVocabulary = async (userId: string, scenarioId: string): Promise<ScenarioVocabularyItem[]> => {
  try {
    const { data, error } = await supabase
      .from('scenario_vocabulary')
      .select('*')
      .eq('user_id', userId)
      .eq('scenario_id', scenarioId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapScenarioVocabFromSupabase);
  } catch (e) {
    console.error("Failed to load scenario vocabulary", e);
    return [];
  }
};

export const saveScenarioWithExpressions = async (
  userId: string,
  title: string,
  expressions: Omit<ScenarioVocabularyItem, 'id' | 'user_id' | 'scenario_id' | 'createdAt' | 'nextReviewDate' | 'interval' | 'repetition' | 'easeFactor'>[]
) => {
  try {
    // 1. Save Scenario
    const scenarioId = generateId();
    const scenarioPayload = {
      id: scenarioId,
      user_id: userId,
      title: title,
      created_at: Date.now(),
    };

    const { error: scenarioError } = await supabase
      .from('scenarios')
      .insert([scenarioPayload]);

    if (scenarioError) throw scenarioError;

    // 2. Save Expressions
    const vocabPayloads = expressions.map(exp => {
      const fullItem: ScenarioVocabularyItem = {
        ...exp,
        id: generateId(),
        user_id: userId,
        scenario_id: scenarioId,
        createdAt: Date.now(),
        nextReviewDate: Date.now(),
        interval: 0,
        repetition: 0,
        easeFactor: 2.5,
      };
      return cleanScenarioVocabPayload(mapScenarioVocabToSupabase(fullItem));
    });

    const { error: vocabError } = await supabase
      .from('scenario_vocabulary')
      .insert(vocabPayloads);

    if (vocabError) throw vocabError;

    return scenarioId;
  } catch (e) {
    console.error("Failed to save scenario and expressions", e);
    throw e;
  }
};

export const deleteScenario = async (scenarioId: string) => {
  try {
    const { error } = await supabase
      .from('scenarios')
      .delete()
      .eq('id', scenarioId);

    if (error) throw error;
  } catch (e) {
    console.error("Failed to delete scenario", e);
    throw e;
  }
};