import React, { useState } from 'react';
import { VocabularyItem } from '../types';
import { generateExpressionContext } from '../services/gemini';
import { getInitialSRSState as getSRS } from '../services/srs';
import { Plus, Loader2, Book, Sparkles, AlertCircle, ExternalLink } from 'lucide-react';
import * as storage from '../services/storage';

interface ExpressionManagerProps {
  items: VocabularyItem[];
  onUpdate: () => void;
  userId: string;
}

const ExpressionManager: React.FC<ExpressionManagerProps> = ({ items, onUpdate, userId }) => {
  const [newExpression, setNewExpression] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpression.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const context = await generateExpressionContext(newExpression);

      const newItem: VocabularyItem = {
        id: storage.generateId(),
        expression: newExpression,
        definition: context.definition,
        examples: context.examples,
        scenario: context.scenario,
        createdAt: Date.now(),
        ...getSRS(),
      };

      await storage.saveItem(newItem, userId);
      setNewExpression('');
      onUpdate();
    } catch (err) {
      setError('Failed to generate context. Please check your API key or try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const highlightMatch = (text: string, term: string) => {
    if (!term.trim() || !text) return text;
    // Escape regex special characters
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');

    return text.split(regex).map((part, i) =>
      part.toLowerCase() === term.toLowerCase() ?
        <span key={i} className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded mx-0.5 border border-indigo-100">{part}</span> :
        part
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Vocabulary Bank</h2>
          <p className="text-slate-500 text-sm">Add expressions to generate context and start memorizing.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-full border border-slate-200 text-sm font-medium text-slate-600 shadow-sm self-start md:self-auto">
          {items.length} Expressions Saved
        </div>
      </div>

      {/* Add Form */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 mb-6 relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-stretch md:items-start">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">New Expression</label>
            <input
              type="text"
              value={newExpression}
              onChange={(e) => setNewExpression(e.target.value)}
              placeholder="e.g., bite the bullet"
              className="w-full text-base md:text-lg p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-300"
              disabled={isLoading}
            />
            {error && <p className="text-red-500 text-xs mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</p>}
          </div>
          <button
            type="submit"
            disabled={isLoading || !newExpression}
            className="md:mt-6 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-200"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Generate
          </button>
        </form>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pr-0 md:pr-2 space-y-4 pb-20">
        {items.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <Book className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-400">Your bank is empty. Add an expression above!</p>
          </div>
        ) : (
          items.slice().reverse().map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-colors group">
              <div className="flex justify-between items-start mb-3 gap-2">
                <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">{item.expression}</h3>
                <div className="flex flex-wrap justify-end gap-2 shrink-0">
                  <a
                    href={`https://dictionary.cambridge.org/dictionary/english/${item.expression.replace(/\s+/g, '-').toLowerCase()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 font-medium bg-indigo-50 px-2 py-1 rounded-md hover:bg-indigo-100 transition-colors"
                    title="View in Cambridge Dictionary"
                  >
                    <span className="hidden md:inline">Dictionary</span> <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-[10px] px-2 py-1 bg-slate-100 rounded text-slate-500 font-mono whitespace-nowrap">
                    Lvl {item.repetition}
                  </span>
                </div>
              </div>
              <p className="text-slate-600 text-sm italic mb-4 border-l-2 border-indigo-200 pl-3">{item.definition}</p>

              <div className="space-y-3 bg-slate-50 p-4 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Scenario</span>
                  <p className="text-sm text-slate-700 leading-relaxed mt-1">{highlightMatch(item.scenario, item.expression)}</p>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-400 uppercase">Examples</span>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {item.examples.map((ex, i) => (
                      <li key={i} className="text-xs md:text-sm text-slate-700">{highlightMatch(ex, item.expression)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ExpressionManager;