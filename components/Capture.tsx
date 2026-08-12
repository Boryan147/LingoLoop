import React, { useState, useEffect } from 'react';
import { VocabularyItem } from '../types';
import { generateIntakeAI } from '../services/gemini';
import { getInitialSRSState } from '../services/srs';
import { Plus, Loader2, Book, Sparkles, AlertCircle, Trash2, ArrowLeftRight, Search, Zap, Eye, Calendar, CheckCircle2, ArrowUp, Edit, X } from 'lucide-react';
import * as storage from '../services/storage';

interface CaptureProps {
  items: VocabularyItem[];
  onUpdate: () => void;
  userId: string;
}

const Capture: React.FC<CaptureProps> = ({ items, onUpdate, userId }) => {
  // Load draft from localStorage on initial render
  const [wordOrPhrase, setWordOrPhrase] = useState(() => {
    try {
      const draft = localStorage.getItem('lingoloop_capture_draft');
      return draft ? JSON.parse(draft).wordOrPhrase || '' : '';
    } catch {
      return '';
    }
  });
  const [vocabType, setVocabType] = useState<'ACTIVE' | 'PASSIVE'>(() => {
    try {
      const draft = localStorage.getItem('lingoloop_capture_draft');
      return draft ? JSON.parse(draft).vocabType || 'ACTIVE' : 'ACTIVE';
    } catch {
      return 'ACTIVE';
    }
  });
  const [contextHint, setContextHint] = useState(() => {
    try {
      const draft = localStorage.getItem('lingoloop_capture_draft');
      return draft ? JSON.parse(draft).contextHint || '' : '';
    } catch {
      return '';
    }
  });
  const [definition, setDefinition] = useState(() => {
    try {
      const draft = localStorage.getItem('lingoloop_capture_draft');
      return draft ? JSON.parse(draft).definition || '' : '';
    } catch {
      return '';
    }
  });
  const [examplesString, setExamplesString] = useState(() => {
    try {
      const draft = localStorage.getItem('lingoloop_capture_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.examplesString !== undefined) return parsed.examplesString;
        if (Array.isArray(parsed.examples)) return parsed.examples.join('\n');
      }
      return '';
    } catch {
      return '';
    }
  });
  const [synonymsString, setSynonymsString] = useState(() => {
    try {
      const draft = localStorage.getItem('lingoloop_capture_draft');
      return draft ? JSON.parse(draft).synonymsString || '' : '';
    } catch {
      return '';
    }
  });
  const [wordFamilyString, setWordFamilyString] = useState(() => {
    try {
      const draft = localStorage.getItem('lingoloop_capture_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.wordFamilyString !== undefined) return parsed.wordFamilyString;
        if (Array.isArray(parsed.word_family)) return parsed.word_family.join(', ');
      }
      return '';
    } catch {
      return '';
    }
  });
  const [editingItem, setEditingItem] = useState<VocabularyItem | null>(() => {
    try {
      const draft = localStorage.getItem('lingoloop_capture_draft_editing');
      return draft ? JSON.parse(draft) : null;
    } catch {
      return null;
    }
  });

  const [originalInput, setOriginalInput] = useState<string | null>(null);
  const [aiChunk, setAiChunk] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ACTIVE' | 'PASSIVE'>('ALL');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showScrollTop, setShowScrollTop] = useState(false);

  // Save draft whenever form values change
  useEffect(() => {
    const draft = {
      wordOrPhrase,
      vocabType,
      contextHint,
      definition,
      examplesString,
      synonymsString,
      wordFamilyString
    };
    localStorage.setItem('lingoloop_capture_draft', JSON.stringify(draft));
  }, [wordOrPhrase, vocabType, contextHint, definition, examplesString, synonymsString, wordFamilyString]);

  // Save editingItem draft
  useEffect(() => {
    if (editingItem) {
      localStorage.setItem('lingoloop_capture_draft_editing', JSON.stringify(editingItem));
    } else {
      localStorage.removeItem('lingoloop_capture_draft_editing');
    }
  }, [editingItem]);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    const handleScroll = () => {
      if (mainEl.scrollTop > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    mainEl.addEventListener('scroll', handleScroll);
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGenerate = async () => {
    if (!wordOrPhrase.trim()) return;
    setIsGenerating(true);
    setError(null);
    const typedBeforeAI = wordOrPhrase.trim();
    try {
      const result = await generateIntakeAI(wordOrPhrase, vocabType, contextHint, synonymsString.trim());
      if (vocabType === 'ACTIVE') {
        const generatedChunk = result.word_or_phrase.trim();
        if (generatedChunk.toLowerCase() !== typedBeforeAI.toLowerCase()) {
          setOriginalInput(typedBeforeAI);
          setAiChunk(generatedChunk);
        } else {
          setOriginalInput(null);
          setAiChunk(null);
        }
        setWordOrPhrase(generatedChunk);
      } else {
        setOriginalInput(null);
        setAiChunk(null);
      }
      setDefinition(result.definition);
      setExamplesString(result.examples ? result.examples.join('\n') : '');
      setSynonymsString(result.synonyms ? result.synonyms.join(', ') : '');
    } catch (err: any) {
      setError(err.message || 'Failed to generate content with AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const clearDraft = () => {
    localStorage.removeItem('lingoloop_capture_draft');
    localStorage.removeItem('lingoloop_capture_draft_editing');
    setWordOrPhrase('');
    setOriginalInput(null);
    setAiChunk(null);
    setContextHint('');
    setDefinition('');
    setExamplesString('');
    setSynonymsString('');
    setWordFamilyString('');
    setEditingItem(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wordOrPhrase.trim() || !definition.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      const parsedSynonyms = synonymsString
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const parsedExamples = examplesString
        .split('\n')
        .map(ex => ex.trim())
        .filter(Boolean);

      const parsedWordFamily = wordFamilyString
        .split(',')
        .map(wf => wf.trim())
        .filter(Boolean);

      if (editingItem) {
        // Update existing item
        const updatedItem: VocabularyItem = {
          ...editingItem,
          word_or_phrase: wordOrPhrase.trim(),
          type: vocabType,
          context_hint: contextHint.trim(),
          definition: definition.trim(),
          examples: parsedExamples,
          synonyms: parsedSynonyms,
          word_family: parsedWordFamily,
          updatedAt: Date.now(),
        };
        await storage.updateItem(updatedItem, userId);
      } else {
        // Create new item
        const newItem: VocabularyItem = {
          id: storage.generateId(),
          user_id: userId,
          word_or_phrase: wordOrPhrase.trim(),
          type: vocabType,
          context_hint: contextHint.trim(),
          definition: definition.trim(),
          examples: parsedExamples,
          synonyms: parsedSynonyms,
          word_family: parsedWordFamily,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...getInitialSRSState(),
        };
        await storage.saveItem(newItem, userId);
      }

      clearDraft();
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to save vocabulary item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (item: VocabularyItem) => {
    setEditingItem(item);
    setOriginalInput(null);
    setAiChunk(null);
    setWordOrPhrase(item.word_or_phrase);
    setVocabType(item.type);
    setContextHint(item.context_hint);
    setDefinition(item.definition);
    setExamplesString(item.examples ? item.examples.join('\n') : '');
    setSynonymsString(item.synonyms ? item.synonyms.join(', ') : '');
    setWordFamilyString(item.word_family ? item.word_family.join(', ') : '');
    scrollToTop();
  };

  const handleCancelEdit = () => {
    clearDraft();
  };

  const handleToggleType = async (item: VocabularyItem) => {
    try {
      await storage.toggleVocabularyType(item.id, item.type, userId);
      onUpdate();
    } catch (err) {
      alert('Failed to toggle vocabulary type.');
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this item? This cannot be undone.')) return;
    try {
      await storage.deleteItem(itemId, userId);
      onUpdate();
    } catch (err) {
      alert('Failed to delete vocabulary item.');
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-slate-100 text-slate-700';
      case 'LEARNING': return 'bg-amber-100 text-amber-700';
      case 'REVIEW': return 'bg-indigo-100 text-indigo-700';
      case 'MASTERED': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const filteredItems = items
    .filter(item => {
      const matchesSearch = 
        (item.word_or_phrase || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.definition || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.context_hint || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.synonyms || []).some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesType = filterType === 'ALL' || item.type === filterType;
      
      return matchesSearch && matchesType;
    });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Capture Vocabulary</h2>
          <p className="text-slate-500 text-sm">Save new active or passive expressions and review them efficiently.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-full border border-slate-200 text-sm font-medium text-slate-600 shadow-sm self-start md:self-auto flex gap-4">
          <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-emerald-500" /> {items.filter(i => i.type === 'ACTIVE').length} Active</span>
          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-blue-500" /> {items.filter(i => i.type === 'PASSIVE').length} Passive</span>
        </div>
      </div>

      {/* Add Form */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 mb-6 relative overflow-hidden shrink-0">
        <div className={`absolute top-0 left-0 w-1.5 h-full ${vocabType === 'ACTIVE' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
        
        <form onSubmit={handleAdd} className="space-y-4">
          {/* Word or Phrase & Type selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                {vocabType === 'ACTIVE' ? 'Your Thoughts (Chinese or Simple English)' : 'English Expression / Word'}
              </label>
              <input
                type="text"
                value={wordOrPhrase}
                onChange={(e) => setWordOrPhrase(e.target.value)}
                placeholder={vocabType === 'ACTIVE' ? "e.g. 表达不想内卷了，顺其自然" : "e.g. obfuscate"}
                className="w-full text-base p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                disabled={isSaving}
                required
              />

              {vocabType === 'ACTIVE' && originalInput && aiChunk && (
                <div className="mt-2.5 p-3 bg-emerald-50/90 border border-emerald-200/90 rounded-xl text-xs space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      AI transformed active expression:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOriginalInput(null);
                        setAiChunk(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                      title="Dismiss option banner"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setWordOrPhrase(originalInput)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 text-left border ${
                        wordOrPhrase.trim() === originalInput.trim()
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                      }`}
                    >
                      <span className="opacity-75 font-normal">Keep Original:</span>
                      <span className="font-bold">"{originalInput}"</span>
                      {wordOrPhrase.trim() === originalInput.trim() && <CheckCircle2 className="w-3.5 h-3.5 ml-1 shrink-0 text-white" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setWordOrPhrase(aiChunk)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 text-left border ${
                        wordOrPhrase.trim() === aiChunk.trim()
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                      }`}
                    >
                      <span className="opacity-75 font-normal">Use AI Chunk:</span>
                      <span className="font-bold">"{aiChunk}"</span>
                      {wordOrPhrase.trim() === aiChunk.trim() && <CheckCircle2 className="w-3.5 h-3.5 ml-1 shrink-0 text-white" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Vocabulary Type</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setVocabType('ACTIVE');
                    setExamplesString('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${vocabType === 'ACTIVE' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVocabType('PASSIVE');
                    setExamplesString('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${vocabType === 'PASSIVE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Passive
                </button>
              </div>
            </div>
          </div>

          {/* Context Hint */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
              {vocabType === 'ACTIVE' ? 'Chinese Context Hint (Optional)' : 'Original Sentence / Source (Optional)'}
            </label>
            <textarea
              value={contextHint}
              onChange={(e) => setContextHint(e.target.value)}
              placeholder={vocabType === 'ACTIVE' ? "Context thought, e.g. 没时间了，硬着头皮做吧" : "Sentence where you found it, e.g. The writer had to obfuscate his true intentions."}
              rows={1.5}
              className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              disabled={isSaving}
            />
          </div>

          {/* Definition */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Definition / Nuance</label>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !wordOrPhrase.trim()}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50 transition-all"
              >
                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-indigo-500" />}
                AI Generate Assist
              </button>
            </div>
            <textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="Enter explanation manually or click AI Generate Assist"
              rows={2}
              className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              disabled={isSaving}
              required
            />
          </div>

          {/* Example Sentences */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
              Example Sentences (Optional, one per line)
            </label>
            <textarea
              value={examplesString}
              onChange={(e) => setExamplesString(e.target.value)}
              placeholder="e.g. This is a natural example sentence.&#10;This is another example."
              rows={3}
              className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              disabled={isSaving}
            />
          </div>

          {/* Synonyms & Word Family grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Synonyms (Optional, comma separated)
              </label>
              <input
                type="text"
                value={synonymsString}
                onChange={(e) => setSynonymsString(e.target.value)}
                placeholder="e.g. avoid, elude, escape"
                className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Word Family (Optional, comma separated)
              </label>
              <input
                type="text"
                value={wordFamilyString}
                onChange={(e) => setWordFamilyString(e.target.value)}
                placeholder="e.g. act, active, activity"
                className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                disabled={isSaving}
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-xs flex items-center gap-1 mt-2">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving || isGenerating || !wordOrPhrase || !definition}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingItem ? (
                <Edit className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {editingItem ? 'Update Vocabulary Item' : 'Save Vocabulary Item'}
            </button>
            {editingItem && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between mb-4 shrink-0">
        <div className="relative w-full md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search words..."
            className="w-full text-sm pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setFilterType('ALL')}
            className={`flex-1 md:flex-initial px-4 py-1 rounded-lg text-xs font-semibold transition-all ${filterType === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('ACTIVE')}
            className={`flex-1 md:flex-initial px-4 py-1 rounded-lg text-xs font-semibold transition-all ${filterType === 'ACTIVE' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-emerald-700'}`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterType('PASSIVE')}
            className={`flex-1 md:flex-initial px-4 py-1 rounded-lg text-xs font-semibold transition-all ${filterType === 'PASSIVE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-blue-700'}`}
          >
            Passive
          </button>
        </div>
      </div>

      {/* Vocabulary list */}
      <div className="space-y-4 pb-24">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
            <Book className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No vocabulary items found.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all shadow-sm group"
            >
              <div className="flex justify-between items-start mb-2 gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
                      {item.word_or_phrase}
                    </h3>
                    
                    <button
                      onClick={() => handleToggleType(item)}
                      title="Click to toggle Active/Passive"
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-all ${item.type === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100'}`}
                    >
                      {item.type === 'ACTIVE' ? (
                        <>
                          <Zap className="w-2.5 h-2.5 fill-current" /> Active
                        </>
                      ) : (
                        <>
                          <Eye className="w-2.5 h-2.5" /> Passive
                        </>
                      )}
                      <ArrowLeftRight className="w-2 h-2 ml-0.5 opacity-60" />
                    </button>

                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getStatusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => handleStartEdit(item)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all sm:opacity-0 group-hover:opacity-100"
                    title="Edit item"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all sm:opacity-0 group-hover:opacity-100"
                    title="Delete item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Definition */}
              <p className="text-sm text-slate-700 italic border-l-2 border-indigo-200 pl-3 mb-3 font-medium">
                {item.definition}
              </p>

              {/* Context Hint */}
              {item.context_hint && (
                <div className="bg-slate-50 p-3 rounded-xl mb-3 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider mb-0.5">
                    {item.type === 'ACTIVE' ? 'Chinese Thought / Scenario' : 'Original Sentence'}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.context_hint}
                  </p>
                </div>
              )}

              {/* Examples */}
              {item.examples && item.examples.length > 0 && (
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider mb-1">Examples</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-xs text-slate-600">
                    {item.examples.map((ex, idx) => (
                      <li key={idx}>{ex}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Synonyms */}
              {item.synonyms && item.synonyms.length > 0 && (
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider mb-1">Synonyms</span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.synonyms.map((syn, idx) => (
                      <span key={idx} className="text-xs bg-slate-100 text-slate-650 border border-slate-200/80 px-2.5 py-0.5 rounded-lg font-medium">
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Word Family */}
              {item.word_family && item.word_family.length > 0 && (
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider mb-1">Word Family</span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.word_family.map((member, idx) => (
                      <span key={idx} className="text-xs bg-indigo-50/50 text-indigo-700 border border-indigo-100/80 px-2.5 py-0.5 rounded-lg font-medium animate-in fade-in duration-300">
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              )}



              {/* SRS Metadata */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Next Review: {new Date(item.nextReviewDate).toLocaleDateString()}</span>
                <span>Reps: {item.repetitions}</span>
                <span>Interval: {item.interval}d</span>
                <span>Ease: {item.easeFactor.toFixed(1)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 md:bottom-6 right-6 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-all transform hover:scale-110 z-50 flex items-center justify-center animate-in fade-in duration-200"
          title="Back to Top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default Capture;
