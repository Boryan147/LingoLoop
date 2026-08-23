import React, { useState, useEffect } from 'react';
import { VocabularyItem } from '../types';
import { calculateNextReview, getInitialSRSState } from '../services/srs';
import { generateDailyPassiveContext, evaluateSentence, generateIntakeAI, formatStoryHTML } from '../services/gemini';
import * as storage from '../services/storage';
import { PartyPopper, Lightbulb, Zap, Eye, Sparkles, Check, HelpCircle, Loader2, ExternalLink, X, AlertCircle, CheckCircle2, Plus, RefreshCw } from 'lucide-react';

interface ReviewSessionProps {
  onComplete: () => void;
  userId: string;
}

const calculatePassiveBatches = (items: VocabularyItem[]): VocabularyItem[][] => {
  const total = items.length;
  if (total === 0) return [];
  
  // Dynamic batch sizing based on total passive queue size
  let maxPerBatch = 5;
  if (total > 30) maxPerBatch = 15;
  else if (total > 20) maxPerBatch = 12;
  else if (total > 10) maxPerBatch = 8;
  else if (total > 5) maxPerBatch = 6;
  else maxPerBatch = Math.max(1, total);

  const numBatches = Math.ceil(total / maxPerBatch);
  const itemsPerBatch = Math.ceil(total / numBatches);

  const batches: VocabularyItem[][] = [];
  for (let i = 0; i < total; i += itemsPerBatch) {
    batches.push(items.slice(i, i + itemsPerBatch));
  }
  return batches;
};

const ReviewSession: React.FC<ReviewSessionProps> = ({ onComplete, userId }) => {
  const [activeQueue, setActiveQueue] = useState<VocabularyItem[]>([]);
  const [passiveQueue, setPassiveQueue] = useState<VocabularyItem[]>([]);
  
  const clearReviewSessionStorage = () => {
    sessionStorage.removeItem('lingoloop_review_story');
    sessionStorage.removeItem('lingoloop_review_story_item_ids');
    sessionStorage.removeItem('lingoloop_review_batch_index');
    sessionStorage.removeItem('lingoloop_review_active_index');
    sessionStorage.removeItem('lingoloop_review_phase');
  };

  // Phase management: 'ACTIVE' -> 'PASSIVE' -> 'COMPLETE'
  const [phase, setPhase] = useState<'LOADING' | 'ACTIVE' | 'PASSIVE' | 'COMPLETE'>('LOADING');

  // ACTIVE Phase states
  const [activeIndex, setActiveIndex] = useState(() => {
    const val = sessionStorage.getItem('lingoloop_review_active_index');
    return val ? parseInt(val, 10) : 0;
  });
  const [isActiveFlipped, setIsActiveFlipped] = useState(false);
  const [sentenceInput, setSentenceInput] = useState('');
  const [sentenceEvaluating, setSentenceEvaluating] = useState(false);
  const [sentenceFeedback, setSentenceFeedback] = useState<{ isCorrect: boolean, feedback: string } | null>(null);
  const [sentenceError, setSentenceError] = useState<string | null>(null);

  const handleEvaluateSentence = async (wordOrPhrase: string) => {
    if (!sentenceInput.trim()) return;
    setSentenceEvaluating(true);
    setSentenceFeedback(null);
    setSentenceError(null);
    try {
      const result = await evaluateSentence(wordOrPhrase, sentenceInput);
      setSentenceFeedback(result);
    } catch (err: any) {
      setSentenceError(err.message || "Failed to evaluate sentence. Try again.");
    } finally {
      setSentenceEvaluating(false);
    }
  };

  // PASSIVE Phase states
  const [selectedText, setSelectedText] = useState('');

  const handleTextSelection = () => {
    if (typeof window !== 'undefined') {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';
      if (text && text.length > 0 && text.length < 60) {
        setSelectedText(text);
      }
    }
  };

  // Capture Word Modal states
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [modalWord, setModalWord] = useState('');
  const [modalType, setModalType] = useState<'ACTIVE' | 'PASSIVE'>('PASSIVE');
  const [modalContext, setModalContext] = useState('');
  const [modalDefinition, setModalDefinition] = useState('');
  const [modalExamples, setModalExamples] = useState('');
  const [modalSynonyms, setModalSynonyms] = useState('');
  const [modalWordFamily, setModalWordFamily] = useState('');
  interface CandidateResult {
    word_or_phrase: string;
    definition: string;
    examples: string[];
    synonyms: string[];
  }

  const [modalOriginalInput, setModalOriginalInput] = useState<string | null>(null);
  const [modalAiChunk, setModalAiChunk] = useState<string | null>(null);
  const [modalAiChunkResult, setModalAiChunkResult] = useState<CandidateResult | null>(null);
  const [modalOriginalResult, setModalOriginalResult] = useState<CandidateResult | null>(null);
  const [isModalGeneratingOriginalMeaning, setIsModalGeneratingOriginalMeaning] = useState(false);
  const [isModalGenerating, setIsModalGenerating] = useState(false);
  const [isModalSaving, setIsModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const openCaptureModal = (initialWord: string = '') => {
    setModalWord(initialWord);
    setModalType('PASSIVE');
    const plainStory = currentStory.replace(/<[^>]*>/g, '');
    setModalContext(plainStory);
    setModalDefinition('');
    setModalExamples('');
    setModalSynonyms('');
    setModalWordFamily('');
    setModalOriginalInput(null);
    setModalAiChunk(null);
    setModalAiChunkResult(null);
    setModalOriginalResult(null);
    setIsModalGeneratingOriginalMeaning(false);
    setModalError(null);
    setIsCaptureModalOpen(true);
  };

  const handleModalGenerate = async () => {
    if (!modalWord.trim()) return;
    setIsModalGenerating(true);
    setModalError(null);
    const typedBeforeAI = modalWord.trim();
    try {
      const result = await generateIntakeAI(modalWord, modalType, modalContext, modalSynonyms.trim());
      if (modalType === 'ACTIVE') {
        const generatedChunk = result.word_or_phrase.trim();
        if (generatedChunk.toLowerCase() !== typedBeforeAI.toLowerCase()) {
          setModalOriginalInput(typedBeforeAI);
          setModalAiChunk(generatedChunk);
          setModalAiChunkResult(result);
          setModalOriginalResult(null);
        } else {
          setModalOriginalInput(null);
          setModalAiChunk(null);
          setModalAiChunkResult(null);
          setModalOriginalResult(null);
        }
        setModalWord(generatedChunk);
      } else {
        setModalOriginalInput(null);
        setModalAiChunk(null);
        setModalAiChunkResult(null);
        setModalOriginalResult(null);
      }
      setModalDefinition(result.definition);
      setModalExamples(result.examples ? result.examples.join('\n') : '');
      setModalSynonyms(result.synonyms ? result.synonyms.join(', ') : '');
    } catch (err: any) {
      setModalError(err.message || 'Failed to generate content with AI.');
    } finally {
      setIsModalGenerating(false);
    }
  };

  const handleModalSelectOriginal = async () => {
    if (!modalOriginalInput) return;
    setModalWord(modalOriginalInput);
    if (modalOriginalResult) {
      setModalDefinition(modalOriginalResult.definition);
      setModalExamples(modalOriginalResult.examples ? modalOriginalResult.examples.join('\n') : '');
      setModalSynonyms(modalOriginalResult.synonyms ? modalOriginalResult.synonyms.join(', ') : '');
    } else {
      setIsModalGeneratingOriginalMeaning(true);
      try {
        const result = await generateIntakeAI(modalOriginalInput, 'ACTIVE', modalContext, modalSynonyms.trim(), true);
        setModalOriginalResult(result);
        setModalDefinition(result.definition);
        setModalExamples(result.examples ? result.examples.join('\n') : '');
        setModalSynonyms(result.synonyms ? result.synonyms.join(', ') : '');
      } catch (err: any) {
        console.error("Failed to generate modal original word meaning:", err);
      } finally {
        setIsModalGeneratingOriginalMeaning(false);
      }
    }
  };

  const handleModalSelectAiChunk = () => {
    if (!modalAiChunk) return;
    setModalWord(modalAiChunk);
    if (modalAiChunkResult) {
      setModalDefinition(modalAiChunkResult.definition);
      setModalExamples(modalAiChunkResult.examples ? modalAiChunkResult.examples.join('\n') : '');
      setModalSynonyms(modalAiChunkResult.synonyms ? modalAiChunkResult.synonyms.join(', ') : '');
    }
  };

  const handleModalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalWord.trim() || !modalDefinition.trim()) return;

    setIsModalSaving(true);
    setModalError(null);

    try {
      const parsedSynonyms = modalSynonyms
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const parsedExamples = modalExamples
        .split('\n')
        .map(ex => ex.trim())
        .filter(Boolean);

      const parsedWordFamily = modalWordFamily
        .split(',')
        .map(wf => wf.trim())
        .filter(Boolean);

      const newItem: VocabularyItem = {
        id: storage.generateId(),
        user_id: userId,
        word_or_phrase: modalWord.trim(),
        type: modalType,
        context_hint: modalContext.trim(),
        definition: modalDefinition.trim(),
        examples: parsedExamples,
        synonyms: parsedSynonyms,
        word_family: parsedWordFamily,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...getInitialSRSState(),
      };
      await storage.saveItem(newItem, userId);
      setIsCaptureModalOpen(false);
      setSelectedText('');
    } catch (err: any) {
      setModalError(err.message || 'Failed to save vocabulary item.');
    } finally {
      setIsModalSaving(false);
    }
  };
  const [passiveBatches, setPassiveBatches] = useState<VocabularyItem[][]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(() => {
    const val = sessionStorage.getItem('lingoloop_review_batch_index');
    return val ? parseInt(val, 10) : 0;
  });
  const [currentStory, setCurrentStory] = useState(() => {
    return sessionStorage.getItem('lingoloop_review_story') || '';
  });
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);

  // Batch states
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [batchRatings, setBatchRatings] = useState<Record<string, number>>({});

  useEffect(() => {
    if (phase !== 'LOADING') {
      sessionStorage.setItem('lingoloop_review_phase', phase);
    }
  }, [phase]);

  useEffect(() => {
    sessionStorage.setItem('lingoloop_review_active_index', activeIndex.toString());
  }, [activeIndex]);

  useEffect(() => {
    sessionStorage.setItem('lingoloop_review_batch_index', currentBatchIndex.toString());
  }, [currentBatchIndex]);

  useEffect(() => {
    sessionStorage.setItem('lingoloop_review_story', currentStory);
    if (!currentStory) {
      sessionStorage.removeItem('lingoloop_review_story_item_ids');
    } else if (phase === 'PASSIVE' && passiveBatches.length > 0 && currentBatchIndex < passiveBatches.length) {
      const batch = passiveBatches[currentBatchIndex];
      const currentItemIds = batch.map(item => item.id).join(',');
      sessionStorage.setItem('lingoloop_review_story_item_ids', currentItemIds);
    }
  }, [currentStory, currentBatchIndex, passiveBatches, phase]);

  useEffect(() => {
    const fetchDue = async () => {
      const allItems = await storage.getItems(userId);
      const dueItems = allItems.filter(item => item.nextReviewDate <= Date.now());
      
      const active = dueItems.filter(item => item.type === 'ACTIVE');
      const passive = dueItems.filter(item => item.type === 'PASSIVE');
      
      setActiveQueue(active);
      setPassiveQueue(passive);

      // Create dynamically scaled passive batches based on total passive queue size
      const batches = calculatePassiveBatches(passive);
      setPassiveBatches(batches);

      const savedPhase = sessionStorage.getItem('lingoloop_review_phase');
      const savedActiveIndex = Number(sessionStorage.getItem('lingoloop_review_active_index') || '0');
      const savedBatchIndex = Number(sessionStorage.getItem('lingoloop_review_batch_index') || '0');

      let finalPhase = savedPhase;
      let finalActiveIndex = savedActiveIndex;

      // If we are starting fresh (no index progress has been recorded yet),
      // we decide the phase dynamically. If both active and passive are due, we force SELECT mode
      // so the user can choose. If only one is due, we auto-route them.
      const isFreshSession = savedActiveIndex === 0 && savedBatchIndex === 0;
      if (isFreshSession) {
        if (active.length > 0 && batches.length > 0) {
          finalPhase = 'SELECT';
        } else if (active.length > 0) {
          finalPhase = 'ACTIVE';
        } else if (batches.length > 0) {
          finalPhase = 'PASSIVE';
        } else {
          finalPhase = 'COMPLETE';
        }
        sessionStorage.setItem('lingoloop_review_phase', finalPhase);
      } else {
        // Bounds checking for resume cases
        if (savedPhase === 'ACTIVE') {
          if (active.length === 0 || savedActiveIndex >= active.length) {
            finalActiveIndex = 0;
            setActiveIndex(0);
            sessionStorage.setItem('lingoloop_review_active_index', '0');
            if (batches.length > 0) {
              finalPhase = 'SELECT';
              sessionStorage.setItem('lingoloop_review_phase', 'SELECT');
            } else {
              finalPhase = 'COMPLETE';
              sessionStorage.setItem('lingoloop_review_phase', 'COMPLETE');
            }
          }
        } else if (savedPhase === 'PASSIVE') {
          if (batches.length === 0 || savedBatchIndex >= batches.length) {
            setCurrentBatchIndex(0);
            sessionStorage.setItem('lingoloop_review_batch_index', '0');
            if (active.length > 0) {
              finalPhase = 'SELECT';
              sessionStorage.setItem('lingoloop_review_phase', 'SELECT');
            } else {
              finalPhase = 'COMPLETE';
              sessionStorage.setItem('lingoloop_review_phase', 'COMPLETE');
            }
          }
        }
      }

      if (finalPhase === 'ACTIVE' || finalPhase === 'PASSIVE' || finalPhase === 'SELECT' || finalPhase === 'COMPLETE') {
        setPhase(finalPhase as any);
      } else {
        if (active.length > 0 || batches.length > 0) {
          setPhase('SELECT');
        } else {
          setPhase('COMPLETE');
        }
      }
    };
    fetchDue();
  }, [userId]);

  const loadBatchStory = async () => {
    setIsGeneratingStory(true);
    setStoryError(null);
    setCurrentStory('');
    setRevealedIds({});
    setBatchRatings({});
    
    try {
      const batch = passiveBatches[currentBatchIndex];
      const story = await generateDailyPassiveContext(batch);
      setCurrentStory(story);
    } catch (err: any) {
      console.error("Story context loading error", err);
      setStoryError(err.message || "Failed to generate story context.");
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Handle micro-story generation and TTS loading when entering a new PASSIVE batch
  useEffect(() => {
    if (phase === 'PASSIVE' && passiveBatches.length > 0 && currentBatchIndex < passiveBatches.length) {
      const batch = passiveBatches[currentBatchIndex];
      const currentItemIds = batch.map(item => item.id).join(',');
      const savedStory = sessionStorage.getItem('lingoloop_review_story');
      const savedItemIds = sessionStorage.getItem('lingoloop_review_story_item_ids');
      if (savedStory && savedItemIds === currentItemIds) {
        return;
      }

      loadBatchStory();
    }
  }, [phase, currentBatchIndex, passiveBatches]);

  const handleActiveRating = async (rating: number) => {
    const currentItem = activeQueue[activeIndex];
    const updates = calculateNextReview(currentItem, rating);
    const updatedItem = { ...currentItem, ...updates, updatedAt: Date.now() } as VocabularyItem;
    await storage.updateItem(updatedItem, userId);

    if (activeIndex < activeQueue.length - 1) {
      setIsActiveFlipped(false);
      setSentenceInput('');
      setSentenceFeedback(null);
      setSentenceError(null);
      setTimeout(() => setActiveIndex(prev => prev + 1), 150);
    } else {
      // Finished ACTIVE phase
      sessionStorage.removeItem('lingoloop_review_active_index');
      setActiveQueue([]);
      if (passiveBatches.length > 0) {
        setPhase('SELECT');
        sessionStorage.setItem('lingoloop_review_phase', 'SELECT');
      } else {
        clearReviewSessionStorage();
        setPhase('COMPLETE');
      }
    }
  };

  const handleRateBatchItem = (itemId: string, rating: number) => {
    setBatchRatings(prev => ({ ...prev, [itemId]: rating }));
  };

  const submitPassiveBatch = async () => {
    const batch = passiveBatches[currentBatchIndex];
    
    // Save all reviews for the current batch
    for (const item of batch) {
      const rating = batchRatings[item.id] || 3; // Default to Good if unrated (safety)
      const updates = calculateNextReview(item, rating);
      const updatedItem = { ...item, ...updates, updatedAt: Date.now() } as VocabularyItem;
      await storage.updateItem(updatedItem, userId);
    }

    if (currentBatchIndex < passiveBatches.length - 1) {
      sessionStorage.removeItem('lingoloop_review_story');
      setCurrentStory('');
      setCurrentBatchIndex(prev => prev + 1);
    } else {
      sessionStorage.removeItem('lingoloop_review_story');
      sessionStorage.removeItem('lingoloop_review_story_item_ids');
      sessionStorage.removeItem('lingoloop_review_batch_index');
      setPassiveBatches([]);
      if (activeQueue.length > 0) {
        setPhase('SELECT');
        sessionStorage.setItem('lingoloop_review_phase', 'SELECT');
      } else {
        clearReviewSessionStorage();
        setPhase('COMPLETE');
      }
    }
  };

  const toggleReveal = (itemId: string) => {
    setRevealedIds(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // --- RENDERING ---

  if (phase === 'LOADING') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (phase === 'SELECT') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] text-center p-4 md:p-8 animate-in fade-in duration-300">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Daily Review</h2>
        <p className="text-slate-500 mb-8 max-w-md">
          Choose which vocabulary type you want to practice first. Let's keep that forgetting curve flat!
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mb-8">
          {/* Active Recall Card */}
          <button
            onClick={() => {
              if (activeQueue.length > 0) {
                setPhase('ACTIVE');
                sessionStorage.setItem('lingoloop_review_phase', 'ACTIVE');
              }
            }}
            disabled={activeQueue.length === 0}
            className={`flex flex-col items-center text-center p-6 md:p-8 rounded-3xl border bg-white transition-all shadow-sm group select-none relative overflow-hidden ${activeQueue.length > 0 ? 'hover:shadow-xl hover:border-emerald-500 hover:scale-[1.02] cursor-pointer border-slate-200/80' : 'opacity-60 border-slate-200/50 cursor-not-allowed'}`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-5 ${activeQueue.length > 0 ? 'bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform' : 'bg-slate-100 text-slate-400'}`}>
              <Zap className={`w-6 h-6 ${activeQueue.length > 0 ? 'fill-current' : ''}`} />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${activeQueue.length > 0 ? 'text-slate-800' : 'text-slate-400'}`}>Active Recall</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4 max-w-[200px]">
              Recall the authentic English expression matching your trigger thought.
            </p>
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${activeQueue.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {activeQueue.length > 0 ? `${activeQueue.length} items due` : 'All Caught Up!'}
            </span>
          </button>

          {/* Passive Story Card */}
          <button
            onClick={() => {
              if (passiveBatches.length > 0) {
                setPhase('PASSIVE');
                sessionStorage.setItem('lingoloop_review_phase', 'PASSIVE');
              }
            }}
            disabled={passiveBatches.length === 0}
            className={`flex flex-col items-center text-center p-6 md:p-8 rounded-3xl border bg-white transition-all shadow-sm group select-none relative overflow-hidden ${passiveBatches.length > 0 ? 'hover:shadow-xl hover:border-blue-500 hover:scale-[1.02] cursor-pointer border-slate-200/80' : 'opacity-60 border-slate-200/50 cursor-not-allowed'}`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-5 ${passiveBatches.length > 0 ? 'bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform' : 'bg-slate-100 text-slate-400'}`}>
              <Eye className="w-6 h-6" />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${passiveBatches.length > 0 ? 'text-slate-800' : 'text-slate-400'}`}>Passive Review</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4 max-w-[200px]">
              Read custom AI stories using your target vocabulary.
            </p>
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${passiveBatches.length > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
              {passiveBatches.length > 0 ? `${passiveBatches.length} batches due` : 'All Caught Up!'}
            </span>
          </button>
        </div>

        <button
          onClick={() => {
            clearReviewSessionStorage();
            onComplete();
          }}
          className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all text-xs shadow-sm hover:shadow"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (phase === 'COMPLETE') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <PartyPopper className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Review Complete!</h2>
        <p className="text-slate-500 mb-8">
          You completed all active and passive reviews for today.
        </p>
        <button
          onClick={() => {
            clearReviewSessionStorage();
            onComplete();
          }}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const currentActiveItem = activeQueue[activeIndex];

  return (
    <div className="w-full bg-slate-50">
      <div className="min-h-full flex flex-col items-center p-4 md:p-6 pb-24 md:pb-6">
        <div className="w-full max-w-2xl flex flex-col flex-1">
          
          {/* Header */}
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider shrink-0">
            <div className="flex items-center gap-2.5">
              <span>
                {phase === 'ACTIVE' ? (
                  <span className="flex items-center gap-1">
                    Active Recall Flashcards <Zap className="w-3 h-3 text-emerald-500 fill-current" />
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    Passive Story Review <Eye className="w-3 h-3 text-blue-500" />
                  </span>
                )}
              </span>
              {(activeQueue.length > 0 && passiveBatches.length > 0) && (
                <button
                  onClick={() => {
                    setPhase('SELECT');
                    sessionStorage.setItem('lingoloop_review_phase', 'SELECT');
                  }}
                  className="px-2.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg text-[10px] font-bold normal-case transition-all border border-slate-200 shrink-0 cursor-pointer"
                >
                  Switch Mode
                </button>
              )}
            </div>
            <span>
              {phase === 'ACTIVE' 
                ? `${activeIndex + 1} / ${activeQueue.length}`
                : `Batch ${currentBatchIndex + 1} / ${passiveBatches.length}`
              }
            </span>
          </div>

          {/* ACTIVE recall flashcards */}
          {phase === 'ACTIVE' && currentActiveItem && (
            <>
              <div className="flex-1 relative perspective-1000 min-h-[50vh] md:min-h-[350px] mb-6">
                <div 
                  className={`relative w-full h-full transition-all duration-500 transform-style-3d grid grid-cols-1 grid-rows-1 ${isActiveFlipped ? 'rotate-y-180' : ''}`}
                  onClick={() => !isActiveFlipped && setIsActiveFlipped(true)}
                >
                  {/* Front Card */}
                  <div className={`col-start-1 row-start-1 w-full h-full bg-white rounded-3xl shadow-xl border border-slate-200/80 flex flex-col p-6 md:p-10 backface-hidden cursor-pointer hover:shadow-2xl transition-all overflow-y-auto custom-scrollbar ${isActiveFlipped ? 'pointer-events-none' : 'z-20'}`}>
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                        <Zap className="w-7 h-7 text-emerald-500 fill-current" />
                      </div>
                      <span className="text-xs md:text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-wide mb-3">
                        {currentActiveItem.context_hint 
                          ? "Trigger Thought (Recall the English Phrase)" 
                          : "English Expression (Recall the Meaning)"}
                      </span>
                      <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-normal max-w-md">
                        {currentActiveItem.context_hint || currentActiveItem.word_or_phrase}
                      </h2>
                      <button className="mt-8 text-xs font-bold text-indigo-650">Reveal Answer</button>
                    </div>
                  </div>

                  {/* Back Card */}
                  <div className={`col-start-1 row-start-1 w-full h-full bg-emerald-600 border border-emerald-500 rounded-3xl shadow-xl flex flex-col p-6 md:p-10 rotate-y-180 backface-hidden text-white overflow-y-auto custom-scrollbar ${isActiveFlipped ? 'z-20' : 'pointer-events-none'}`}>
                    <div className="flex-1 flex flex-col justify-center space-y-5">
                      <div className="text-center pb-3 border-b border-white/20">
                        <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70 mb-1">Authentic Phrase</span>
                        <h2 className="text-2xl md:text-3xl font-black">{currentActiveItem.word_or_phrase}</h2>
                        <div className="mt-2.5 flex justify-center">
                          <a
                            href={`https://youglish.com/pronounce/${encodeURIComponent(currentActiveItem.word_or_phrase)}/english`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 hover:bg-white/25 active:bg-white/35 text-white rounded-lg text-[11px] font-semibold transition-all border border-white/10 cursor-pointer shadow-sm hover:scale-[1.02]"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Shadow on YouGlish</span>
                          </a>
                        </div>
                      </div>
                      <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                        <span className="text-[10px] font-bold text-yellow-300 uppercase tracking-wider block mb-1">nuance / Definition</span>
                        <p className="text-sm font-semibold">{currentActiveItem.definition}</p>
                      </div>
                      {currentActiveItem.examples && currentActiveItem.examples.length > 0 && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Examples</span>
                          <ul className="list-disc pl-4 space-y-1 text-xs opacity-90">
                            {currentActiveItem.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                          </ul>
                        </div>
                      )}
                      {currentActiveItem.synonyms && currentActiveItem.synonyms.length > 0 && (
                        <div className="bg-white/10 p-4 rounded-xl border border-white/10 animate-in fade-in">
                          <span className="text-[10px] font-bold text-yellow-300 uppercase tracking-wider block mb-1">Synonyms</span>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {currentActiveItem.synonyms.map((syn, idx) => (
                              <span key={idx} className="text-xs bg-white/20 px-2 py-0.5 rounded-md font-medium">
                                {syn}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {currentActiveItem.word_family && currentActiveItem.word_family.length > 0 && (
                        <div className="bg-white/15 p-4 rounded-xl border border-white/10 animate-in fade-in">
                          <span className="text-[10px] font-bold text-yellow-300 uppercase tracking-wider block mb-1">Word Family</span>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {currentActiveItem.word_family.map((member, idx) => (
                              <span key={idx} className="text-xs bg-white/25 px-2 py-0.5 rounded-md font-medium">
                                {member}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Optional Practice Box */}
                      <div className="mt-4 pt-4 border-t border-white/20 border-dashed">
                        <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70 mb-2 font-semibold">Practice: Make a Sentence (Optional)</span>
                        <div className="flex gap-2 items-start">
                          <textarea
                            value={sentenceInput}
                            onChange={(e) => setSentenceInput(e.target.value)}
                            placeholder={`Write a sentence using "${currentActiveItem.word_or_phrase}"...`}
                            className="flex-1 text-xs p-2 bg-white/10 text-white placeholder-white/50 border border-white/25 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 resize-none h-14"
                          />
                          <button
                            onClick={() => handleEvaluateSentence(currentActiveItem.word_or_phrase)}
                            disabled={!sentenceInput.trim() || sentenceEvaluating}
                            className="px-4 py-2 bg-white text-emerald-700 rounded-xl font-bold text-xs hover:bg-emerald-50 disabled:opacity-50 transition-all shadow-md shrink-0 flex items-center justify-center h-14"
                          >
                            {sentenceEvaluating ? <Loader2 className="w-4 h-4 animate-spin text-emerald-700" /> : 'Check'}
                          </button>
                        </div>
                        {sentenceFeedback && (
                          <div className={`mt-2.5 p-3 rounded-xl flex items-start gap-2 text-xs leading-relaxed ${sentenceFeedback.isCorrect ? 'bg-emerald-500/30 border border-emerald-400/40 text-emerald-50' : 'bg-rose-500/30 border border-rose-400/40 text-rose-50'}`}>
                            {sentenceFeedback.isCorrect ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                            <p>{sentenceFeedback.feedback}</p>
                          </div>
                        )}
                        {sentenceError && (
                          <div className="mt-2.5 p-2.5 text-xs text-rose-200 bg-rose-500/20 rounded-xl border border-rose-500/30">
                            {sentenceError}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTIVE controls */}
              <div className={`transition-all duration-300 shrink-0 ${isActiveFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <p className="text-center text-slate-400 text-xs mb-3 font-medium">How difficult was it to recall?</p>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => handleActiveRating(1)} className="flex flex-col items-center p-2 rounded-xl bg-white border-b-2 border-slate-200 hover:bg-red-50 transition-all shadow-sm">
                    <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">1</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">Forgot</span>
                  </button>
                  <button onClick={() => handleActiveRating(2)} className="flex flex-col items-center p-2 rounded-xl bg-white border-b-2 border-slate-200 hover:bg-orange-50 transition-all shadow-sm">
                    <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">2</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">Hard</span>
                  </button>
                  <button onClick={() => handleActiveRating(3)} className="flex flex-col items-center p-2 rounded-xl bg-white border-b-2 border-slate-200 hover:bg-blue-50 transition-all shadow-sm">
                    <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">3</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">Good</span>
                  </button>
                  <button onClick={() => handleActiveRating(4)} className="flex flex-col items-center p-2 rounded-xl bg-white border-b-2 border-slate-200 hover:bg-green-50 transition-all shadow-sm">
                    <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm">4</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">Easy</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* PASSIVE micro-story reviews */}
          {phase === 'PASSIVE' && (
            <div className="space-y-6">
              {/* Story Card */}
              <div 
                className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200/80 relative overflow-hidden"
                onMouseUp={handleTextSelection}
                onTouchEnd={handleTextSelection}
              >
                <div className="absolute top-0 right-0 p-4 flex items-center gap-1.5 text-xs text-indigo-500 font-semibold bg-indigo-50/60 rounded-bl-2xl">
                  <Sparkles className="w-3.5 h-3.5" /> AI Story Context
                </div>
                
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Reading & Listening Practice</h3>
                
                {isGeneratingStory ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="text-sm font-medium">Generating story context...</span>
                  </div>
                ) : storyError ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
                    <div className="p-3 bg-red-50 text-red-500 rounded-full">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-md">
                      <p className="text-sm font-bold text-slate-800">Story Generation Failed</p>
                      <p className="text-xs text-slate-500">{storyError}</p>
                    </div>
                    <button
                      onClick={loadBatchStory}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer mt-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Story Generation</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <p 
                      className="text-lg text-slate-800 leading-relaxed font-sans mb-6 font-medium story-text"
                      dangerouslySetInnerHTML={{ __html: formatStoryHTML(currentStory, passiveBatches[currentBatchIndex]) || "No story context generated." }}
                    />
                    
                    {/* Capture word button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => openCaptureModal(selectedText)}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-150 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-100/50 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02] shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{selectedText ? `Capture "${selectedText}"` : 'Capture Word from Story'}</span>
                      </button>
                    </div>

                    {selectedText && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs animate-in fade-in duration-200">
                        <span className="text-slate-500 font-medium">Selected text: <strong className="text-slate-800 font-semibold">"{selectedText}"</strong></span>
                        <button
                          onClick={() => {
                            if (typeof window !== 'undefined') window.getSelection()?.removeAllRanges();
                            setSelectedText('');
                          }}
                          className="text-slate-400 hover:text-slate-600 font-bold"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Items breakdown & ratings */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Test Vocabulary Recall</h4>
                {passiveBatches[currentBatchIndex]?.map((item) => {
                  const isRevealed = !!revealedIds[item.id];
                  const currentRating = batchRatings[item.id];
                  return (
                    <div 
                      key={item.id}
                      className={`bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-150 transition-all ${isRevealed ? 'ring-1 ring-indigo-100 shadow-md' : 'shadow-sm'}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="font-extrabold text-base text-slate-900">{item.word_or_phrase}</h5>
                        <button
                          onClick={() => toggleReveal(item.id)}
                          className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          {isRevealed ? "Hide Definition" : "Reveal Meaning"}
                        </button>
                      </div>

                      {isRevealed && (
                        <div className="space-y-3 mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-1 duration-200">
                          <p className="text-sm text-slate-700 italic border-l-2 border-indigo-500 pl-3 font-semibold">
                            {item.definition}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <a
                              href={`https://youglish.com/pronounce/${encodeURIComponent(item.word_or_phrase)}/english`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-150 text-indigo-700 rounded-lg text-xs font-semibold transition-all border border-indigo-100/60 cursor-pointer hover:scale-[1.02] shadow-sm"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Shadow on YouGlish</span>
                            </a>
                          </div>
                          {item.context_hint && (
                            <div className="bg-slate-50 p-2.5 rounded-lg text-xs text-slate-500">
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Original context</span>
                              {item.context_hint}
                            </div>
                          )}

                          {item.synonyms && item.synonyms.length > 0 && (
                            <div className="bg-slate-50 p-2.5 rounded-lg text-xs text-slate-655 border border-slate-200/80 px-2 py-0.5 rounded-md font-medium">
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Synonyms</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.synonyms.map((syn, idx) => (
                                  <span key={idx} className="text-xs bg-white text-slate-650 border border-slate-200/80 px-2 py-0.5 rounded-md font-medium">
                                    {syn}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {item.word_family && item.word_family.length > 0 && (
                            <div className="bg-slate-50 p-2.5 rounded-lg text-xs text-slate-650 border border-slate-150 animate-in fade-in">
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Word Family</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.word_family.map((member, idx) => (
                                  <span key={idx} className="text-xs bg-white text-slate-650 border border-slate-200/80 px-2 py-0.5 rounded-md font-medium">
                                    {member}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Individual item ratings */}
                          <div className="pt-2 border-t border-slate-100/50 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Rate your recall:</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map((score) => {
                                const labels = ["Forgot", "Hard", "Good", "Easy"];
                                const activeColor = ["bg-red-500 text-white", "bg-orange-500 text-white", "bg-blue-500 text-white", "bg-green-500 text-white"];
                                const selected = currentRating === score;
                                return (
                                  <button
                                    key={score}
                                    onClick={() => handleRateBatchItem(item.id, score)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${selected ? activeColor[score - 1] + ' border-transparent shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                  >
                                    {labels[score - 1]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit Batch Control */}
              <div className="pt-4 shrink-0">
                <button
                  onClick={submitPassiveBatch}
                  disabled={
                    isGeneratingStory || 
                    passiveBatches[currentBatchIndex]?.some(item => batchRatings[item.id] === undefined)
                  }
                  className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                  <Check className="w-5 h-5" /> Submit Batch reviews
                </button>
                {passiveBatches[currentBatchIndex]?.some(item => batchRatings[item.id] === undefined) && (
                  <p className="text-center text-xs text-slate-400 mt-2 font-medium">Please reveal and rate all items in the batch to continue.</p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Capture Word Modal */}
      {isCaptureModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in zoom-in-95 duration-200 custom-scrollbar text-slate-800">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                <Plus className="w-5 h-5 text-indigo-600" /> Capture Word from Story
              </h3>
              <button 
                onClick={() => setIsCaptureModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleModalSave} className="space-y-4 text-left">
              {/* Word & Type Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    {modalType === 'ACTIVE' ? 'Your Thoughts (Chinese/Simple English)' : 'English Expression / Word'}
                  </label>
                  <input
                    type="text"
                    value={modalWord}
                    onChange={(e) => setModalWord(e.target.value)}
                    placeholder={modalType === 'ACTIVE' ? "e.g. 表达不想内卷了，顺其自然" : "e.g. obfuscate"}
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 font-medium"
                    required
                  />

                  {modalType === 'ACTIVE' && modalOriginalInput && modalAiChunk && (
                    <div className="mt-2.5 p-2.5 bg-emerald-50/90 border border-emerald-200/90 rounded-xl text-xs space-y-1.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-900 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          AI transformed active expression:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setModalOriginalInput(null);
                            setModalAiChunk(null);
                          }}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                          title="Dismiss option banner"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={handleModalSelectOriginal}
                          disabled={isModalGeneratingOriginalMeaning}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 text-left border ${
                            modalWord.trim() === modalOriginalInput.trim()
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                          }`}
                        >
                          {isModalGeneratingOriginalMeaning ? (
                            <Loader2 className="w-3 h-3 animate-spin shrink-0 text-emerald-600" />
                          ) : null}
                          <span className="opacity-75 font-normal">Keep Original:</span>
                          <span className="font-bold">"{modalOriginalInput}"</span>
                          {modalWord.trim() === modalOriginalInput.trim() && !isModalGeneratingOriginalMeaning && (
                            <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0 text-white" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleModalSelectAiChunk}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 text-left border ${
                            modalWord.trim() === modalAiChunk.trim()
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                          }`}
                        >
                          <span className="opacity-75 font-normal">Use AI Chunk:</span>
                          <span className="font-bold">"{modalAiChunk}"</span>
                          {modalWord.trim() === modalAiChunk.trim() && <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0 text-white" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Type</label>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setModalType('ACTIVE')}
                      className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all ${modalType === 'ACTIVE' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-450 hover:text-slate-600'}`}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalType('PASSIVE')}
                      className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all ${modalType === 'PASSIVE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-450 hover:text-slate-600'}`}
                    >
                      Passive
                    </button>
                  </div>
                </div>
              </div>

              {/* Context Hint */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Context Hint (Pre-filled from current story)
                </label>
                <textarea
                  value={modalContext}
                  onChange={(e) => setModalContext(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none text-slate-900 font-medium"
                />
              </div>

              {/* Definition */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Definition / Nuance</label>
                  <button
                    type="button"
                    onClick={handleModalGenerate}
                    disabled={isModalGenerating || !modalWord.trim()}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50 transition-all"
                  >
                    {isModalGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-indigo-500" />}
                    AI Generate Assist
                  </button>
                </div>
                <textarea
                  value={modalDefinition}
                  onChange={(e) => setModalDefinition(e.target.value)}
                  placeholder="Enter explanation manually or click AI Generate Assist"
                  rows={2}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none text-slate-900 font-medium"
                  required
                />
              </div>

              {/* Examples */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Example Sentences (Optional, one per line)
                </label>
                <textarea
                  value={modalExamples}
                  onChange={(e) => setModalExamples(e.target.value)}
                  placeholder="e.g. This is a natural example sentence."
                  rows={2}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 font-medium"
                />
              </div>

              {/* Synonyms & Word Family */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Synonyms (Optional)
                  </label>
                  <input
                    type="text"
                    value={modalSynonyms}
                    onChange={(e) => setModalSynonyms(e.target.value)}
                    placeholder="e.g. elude, escape"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Word Family (Optional)
                  </label>
                  <input
                    type="text"
                    value={modalWordFamily}
                    onChange={(e) => setModalWordFamily(e.target.value)}
                    placeholder="e.g. act, active"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 font-medium"
                  />
                </div>
              </div>

              {modalError && (
                <p className="text-red-500 text-xs flex items-center gap-1 mt-2">
                  <AlertCircle className="w-3.5 h-3.5" /> {modalError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isModalSaving || isModalGenerating || !modalWord.trim() || !modalDefinition.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md text-xs"
                >
                  {isModalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save to Vocabulary
                </button>
                <button
                  type="button"
                  onClick={() => setIsCaptureModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewSession;