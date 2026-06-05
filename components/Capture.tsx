import React, { useState } from 'react';
import { VocabularyItem } from '../types';
import { generateDefinition } from '../services/gemini';
import { getInitialSRSState } from '../services/srs';
import { Plus, Loader2, Book, Sparkles, AlertCircle, Trash2, ArrowLeftRight, Search, Zap, Eye, Calendar } from 'lucide-react';
import * as storage from '../services/storage';

interface CaptureProps {
  items: VocabularyItem[];
  onUpdate: () => void;
  userId: string;
}

const Capture: React.FC<CaptureProps> = ({ items, onUpdate, userId }) => {
  const [wordOrPhrase, setWordOrPhrase] = useState('');
  const [vocabType, setVocabType] = useState<'ACTIVE' | 'PASSIVE'>('ACTIVE');
  const [contextHint, setContextHint] = useState('');
  const [definition, setDefinition] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ACTIVE' | 'PASSIVE'>('ALL');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!wordOrPhrase.trim()) return;
    setIsGenerating(false);
    setIsGenerating(true);
    setError(null);
    try {
      const def = await generateDefinition(wordOrPhrase, vocabType, contextHint);
      setDefinition(def);
    } catch (err: any) {
      setError(err.message || 'Failed to generate definition.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wordOrPhrase.trim() || !definition.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      const newItem: VocabularyItem = {
        id: storage.generateId(),
        user_id: userId,
        word_or_phrase: wordOrPhrase.trim(),
        type: vocabType,
        context_hint: contextHint.trim(),
        definition: definition.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...getInitialSRSState(),
      };

      await storage.saveItem(newItem, userId);
      setWordOrPhrase('');
      setContextHint('');
      setDefinition('');
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to save vocabulary item.');
    } finally {
      setIsSaving(false);
    }
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
        item.word_or_phrase.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.definition.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.context_hint.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = filterType === 'ALL' || item.type === filterType;
      
      return matchesSearch && matchesType;
    });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto h-full flex flex-col">
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
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Expression / Word</label>
              <input
                type="text"
                value={wordOrPhrase}
                onChange={(e) => setWordOrPhrase(e.target.value)}
                placeholder="e.g. bite the bullet"
                className="w-full text-base p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                disabled={isSaving}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Vocabulary Type</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setVocabType('ACTIVE')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${vocabType === 'ACTIVE' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setVocabType('PASSIVE')}
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
              {vocabType === 'ACTIVE' ? 'Chinese Thought / Trigger Scenario' : 'Original Context Sentence / Source'}
            </label>
            <textarea
              value={contextHint}
              onChange={(e) => setContextHint(e.target.value)}
              placeholder={vocabType === 'ACTIVE' ? "What thought triggers this phrase? e.g. 没时间了，硬着头皮做吧" : "Where did you see this phrase? e.g. He decided to bite the bullet and sign the deal."}
              rows={2}
              className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              disabled={isSaving}
            />
          </div>

          {/* Definition */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Definition</label>
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
              placeholder="Enter definition manually or click AI Generate Assist"
              rows={2}
              className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              disabled={isSaving}
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs flex items-center gap-1 mt-2">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving || isGenerating || !wordOrPhrase || !definition}
            className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Save Vocabulary Item
          </button>
        </form>
      </div>

      {/* List Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between mb-4 shrink-0">
        {/* Search */}
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

        {/* Tab Filters */}
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
      <div className="flex-1 overflow-y-auto pr-0 md:pr-1 space-y-4 pb-20">
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
                    
                    {/* Type indicator and toggle */}
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

                    {/* Status badge */}
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getStatusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
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
                    {item.type === 'ACTIVE' ? 'Trigger Scenario (Chinese)' : 'Context Sentence (Source)'}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    {item.context_hint}
                  </p>
                </div>
              )}

              {/* SRS Metadata */}
              <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Next Review: {new Date(item.nextReviewDate).toLocaleDateString()}</span>
                <span>Reps: {item.repetitions}</span>
                <span>Interval: {item.interval}d</span>
                <span>Ease: {item.easeFactor.toFixed(1)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Capture;
