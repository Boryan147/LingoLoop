import React, { useState, useEffect, useRef } from 'react';
import { getQuickDefinition, generateExpressionContext } from '../services/gemini';
import { saveItem } from '../services/storage';
import { getInitialSRSState } from '../services/srs';
import { VocabularyItem } from '../types';
import { Loader2, Plus, BookOpen, X } from 'lucide-react';

interface InteractiveNarrativeProps {
  text: string;
  onVocabularyAdded: () => void;
}

const InteractiveNarrative: React.FC<InteractiveNarrativeProps> = ({ text, onVocabularyAdded }) => {
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [loadingDef, setLoadingDef] = useState(false);
  const [addingToDeck, setAddingToDeck] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clear selection when text changes
    setSelection(null);
    setDefinition(null);
  }, [text]);

  const handleMouseUp = () => {
    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed) {
      // Allow clearing selection by clicking elsewhere
      if (selection && !loadingDef && !addingToDeck) {
         setSelection(null);
         setDefinition(null);
      }
      return;
    }

    const text = windowSelection.toString().trim();
    if (text.length > 0 && containerRef.current?.contains(windowSelection.anchorNode)) {
      const range = windowSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelection({ text, rect });
      setDefinition(null); // Reset definition for new selection
    }
  };

  const handleGetDefinition = async () => {
    if (!selection) return;
    setLoadingDef(true);
    try {
      const def = await getQuickDefinition(selection.text, text);
      setDefinition(def);
    } catch (e) {
      setDefinition("Could not load definition.");
    } finally {
      setLoadingDef(false);
    }
  };

  const handleAddToDeck = async () => {
    if (!selection) return;
    setAddingToDeck(true);
    try {
      // We generate full context for the card
      const context = await generateExpressionContext(selection.text);
      
      const newItem: VocabularyItem = {
        id: crypto.randomUUID(),
        expression: selection.text,
        definition: context.definition,
        examples: context.examples,
        scenario: context.scenario,
        createdAt: Date.now(),
        ...getInitialSRSState(),
      };

      saveItem(newItem);
      onVocabularyAdded();
      setSelection(null); // Close popup
    } catch (e) {
      alert("Failed to add to deck. Please try again.");
    } finally {
      setAddingToDeck(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className="text-2xl font-serif text-slate-800 leading-relaxed italic border-l-4 border-indigo-500 pl-4 py-1 cursor-text selection:bg-indigo-200 selection:text-indigo-900"
        onMouseUp={handleMouseUp}
      >
        "{text}"
      </div>
      <p className="mt-2 text-xs text-slate-400 font-sans not-italic pl-5">
        * Double-click a word or highlight a phrase to see its meaning.
      </p>

      {/* Floating Popup */}
      {selection && (
        <div 
            className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-72 animate-in fade-in zoom-in-95 duration-200"
            style={{ 
                top: `${selection.rect.bottom + 10}px`, 
                left: `${Math.min(window.innerWidth - 300, Math.max(10, selection.rect.left))}px` // Prevent overflow
            }}
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-indigo-700 truncate pr-2">"{selection.text}"</h4>
            <button onClick={() => setSelection(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
            </button>
          </div>

          {!definition && !loadingDef && (
             <button 
                onClick={handleGetDefinition}
                className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
             >
                <BookOpen className="w-4 h-4" /> Define
             </button>
          )}

          {loadingDef && (
             <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
             </div>
          )}

          {definition && (
            <div className="space-y-3">
                <p className="text-sm text-slate-600 leading-snug">{definition}</p>
                <button 
                    onClick={handleAddToDeck}
                    disabled={addingToDeck}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-70"
                >
                    {addingToDeck ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add to Study Deck
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InteractiveNarrative;