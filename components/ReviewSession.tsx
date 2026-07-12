import React, { useState, useEffect } from 'react';
import { VocabularyItem } from '../types';
import { calculateNextReview } from '../services/srs';
import { generateDailyPassiveContext, generateSpeech, playBrowserSpeech } from '../services/gemini';
import * as storage from '../services/storage';
import { PartyPopper, Lightbulb, Zap, Eye, Play, Volume2, Sparkles, Check, HelpCircle, Loader2, ExternalLink } from 'lucide-react';

interface ReviewSessionProps {
  onComplete: () => void;
  userId: string;
}

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

  // PASSIVE Phase states
  const [passiveBatches, setPassiveBatches] = useState<VocabularyItem[][]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(() => {
    const val = sessionStorage.getItem('lingoloop_review_batch_index');
    return val ? parseInt(val, 10) : 0;
  });
  const [currentStory, setCurrentStory] = useState(() => {
    return sessionStorage.getItem('lingoloop_review_story') || '';
  });
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
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

      // Create passive batches of 3-5 items
      const batches: VocabularyItem[][] = [];
      for (let i = 0; i < passive.length; i += 4) { // Target batch size: 4
        batches.push(passive.slice(i, i + 4));
      }
      setPassiveBatches(batches);

      const savedPhase = sessionStorage.getItem('lingoloop_review_phase');
      const savedActiveIndex = Number(sessionStorage.getItem('lingoloop_review_active_index') || '0');

      let finalPhase = savedPhase;
      let finalActiveIndex = savedActiveIndex;

      if (savedPhase === 'ACTIVE') {
        if (active.length === 0 || savedActiveIndex >= active.length) {
          finalActiveIndex = 0;
          setActiveIndex(0);
          sessionStorage.setItem('lingoloop_review_active_index', '0');
          if (batches.length > 0) {
            finalPhase = 'PASSIVE';
            sessionStorage.setItem('lingoloop_review_phase', 'PASSIVE');
          } else {
            finalPhase = 'COMPLETE';
            sessionStorage.setItem('lingoloop_review_phase', 'COMPLETE');
          }
        }
      } else if (savedPhase === 'PASSIVE') {
        if (batches.length === 0 || currentBatchIndex >= batches.length) {
          setCurrentBatchIndex(0);
          sessionStorage.setItem('lingoloop_review_batch_index', '0');
          finalPhase = 'COMPLETE';
          sessionStorage.setItem('lingoloop_review_phase', 'COMPLETE');
        }
      }

      if (finalPhase === 'ACTIVE' || finalPhase === 'PASSIVE' || finalPhase === 'COMPLETE') {
        setPhase(finalPhase as any);
      } else {
        if (active.length > 0) {
          setPhase('ACTIVE');
        } else if (batches.length > 0) {
          setPhase('PASSIVE');
        } else {
          setPhase('COMPLETE');
        }
      }
    };
    fetchDue();
  }, [userId]);

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

      const loadBatchStory = async () => {
        setIsGeneratingStory(true);
        setCurrentStory('');
        setAudioUrl(null);
        setIsPlaying(false);
        setRevealedIds({});
        setBatchRatings({});
        
        try {
          const batch = passiveBatches[currentBatchIndex];
          const story = await generateDailyPassiveContext(batch);
          setCurrentStory(story);

          // Attempt Gemini TTS
          const audioBase64 = await generateSpeech(story);
          if (audioBase64) {
            const blob = base64ToBlob(audioBase64, 'audio/mp3');
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
          }
        } catch (err) {
          console.error("Story context loading error", err);
        } finally {
          setIsGeneratingStory(false);
        }
      };
      loadBatchStory();
    }
  }, [phase, currentBatchIndex, passiveBatches]);

  const base64ToBlob = (base64: string, contentType: string) => {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  const handlePlayAudio = () => {
    if (audioUrl) {
      if (isPlaying && audioElement) {
        audioElement.pause();
        setIsPlaying(false);
      } else {
        const audio = audioElement || new Audio(audioUrl);
        audio.onended = () => setIsPlaying(false);
        audio.play();
        setAudioElement(audio);
        setIsPlaying(true);
      }
    } else {
      // Fallback: Web Speech API
      playBrowserSpeech(currentStory);
      setIsPlaying(true);
      setTimeout(() => setIsPlaying(false), 5000); // Temporary indicator state
    }
  };

  const handleActiveRating = async (rating: number) => {
    const currentItem = activeQueue[activeIndex];
    const updates = calculateNextReview(currentItem, rating);
    const updatedItem = { ...currentItem, ...updates, updatedAt: Date.now() } as VocabularyItem;
    await storage.updateItem(updatedItem, userId);

    if (activeIndex < activeQueue.length - 1) {
      setIsActiveFlipped(false);
      setTimeout(() => setActiveIndex(prev => prev + 1), 150);
    } else {
      // Finished ACTIVE phase, proceed to PASSIVE
      if (passiveBatches.length > 0) {
        setPhase('PASSIVE');
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
      setAudioUrl(null);
      setIsPlaying(false);
      if (audioElement) {
        audioElement.pause();
        setAudioElement(null);
      }
      setCurrentBatchIndex(prev => prev + 1);
    } else {
      clearReviewSessionStorage();
      setPhase('COMPLETE');
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
              <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200/80 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 flex items-center gap-1.5 text-xs text-indigo-500 font-semibold bg-indigo-50/60 rounded-bl-2xl">
                  <Sparkles className="w-3.5 h-3.5" /> AI Story Context
                </div>
                
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Reading & Listening Practice</h3>
                
                {isGeneratingStory ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="text-sm font-medium">Generating story context...</span>
                  </div>
                ) : (
                  <>
                    <p 
                      className="text-lg text-slate-800 leading-relaxed font-sans mb-6 font-medium"
                      dangerouslySetInnerHTML={{ __html: currentStory || "No story context generated." }}
                    />
                    
                    {/* Audio Player Controls */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handlePlayAudio}
                        className={`p-3 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'}`}
                        title="Listen to story"
                      >
                        {isPlaying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                      <div>
                        <span className="block text-xs font-bold text-slate-700">Listen to Paragraph</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {audioUrl ? "Authentic Voice Modality" : "Web Speech Synthesis"}
                        </span>
                      </div>
                    </div>
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
    </div>
  );
};

export default ReviewSession;