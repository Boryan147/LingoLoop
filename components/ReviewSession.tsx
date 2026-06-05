import React, { useState, useEffect } from 'react';
import { VocabularyItem } from '../types';
import { calculateNextReview } from '../services/srs';
import * as storage from '../services/storage';
import { PartyPopper, Lightbulb, Zap, Eye, HelpCircle } from 'lucide-react';

interface ReviewSessionProps {
  onComplete: () => void;
  userId: string;
}

const ReviewSession: React.FC<ReviewSessionProps> = ({ onComplete, userId }) => {
  const [queue, setQueue] = useState<VocabularyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const fetchDue = async () => {
      const allItems = await storage.getItems(userId);
      const dueItems = allItems.filter(item => item.nextReviewDate <= Date.now());
      setQueue(dueItems);
    };
    fetchDue();
  }, [userId]);

  const handleRating = async (rating: number) => {
    try {
      const currentItem = queue[currentIndex];
      const updates = calculateNextReview(currentItem, rating);
      const updatedItem = { ...currentItem, ...updates, updatedAt: Date.now() } as VocabularyItem;

      await storage.updateItem(updatedItem, userId);

      if (currentIndex < queue.length - 1) {
        setIsFlipped(false);
        setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
      } else {
        setCompleted(true);
      }
    } catch (err) {
      alert("Failed to save progress. Please try again.");
      console.error(err);
    }
  };

  const handleFlip = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isFlipped) {
      setIsFlipped(true);
    }
  };

  if ((queue.length === 0 && !completed) || completed) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <PartyPopper className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2 font-sans tracking-tight">
          {completed ? "Session Complete!" : "All Caught Up!"}
        </h2>
        <p className="text-slate-500 mb-8">
          {completed ? `You reviewed ${queue.length} items.` : "You have no pending reviews for now."}
        </p>
        <button
          onClick={onComplete}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          {completed ? "Finish" : "Back to Dashboard"}
        </button>
      </div>
    );
  }

  const item = queue[currentIndex];

  return (
    <div className="h-full w-full bg-slate-50 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center p-4 md:p-6 pb-24 md:pb-6">
        <div className="w-full max-w-2xl flex flex-col flex-1">
          {/* Header */}
          <div className="flex justify-between items-center text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider shrink-0">
            <span className="flex items-center gap-1.5">
              Review Session
              <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5 ${item.type === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                {item.type === 'ACTIVE' ? <Zap className="w-2.5 h-2.5 fill-current" /> : <Eye className="w-2.5 h-2.5" />}
                {item.type}
              </span>
            </span>
            <span>{currentIndex + 1} / {queue.length}</span>
          </div>

          {/* Flashcard Area */}
          <div className="flex-1 relative perspective-1000 min-h-[60vh] md:min-h-[400px] mb-6 group">
            <div className={`relative w-full h-full transition-all duration-500 transform-style-3d grid grid-cols-1 grid-rows-1 ${isFlipped ? 'rotate-y-180' : ''}`}>

              {/* Front Face */}
              <div
                className={`col-start-1 row-start-1 w-full h-full bg-white rounded-3xl shadow-xl border border-slate-200/80 flex flex-col p-6 md:p-10 backface-hidden cursor-pointer hover:shadow-2xl transition-all overflow-y-auto custom-scrollbar ${isFlipped ? 'pointer-events-none' : 'z-20'}`}
                onClick={handleFlip}
              >
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                    <Lightbulb className="w-6 h-6 md:w-8 md:h-8 text-indigo-500" />
                  </div>
                  
                  {item.type === 'ACTIVE' ? (
                    <>
                      <span className="text-xs md:text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-wide mb-3">
                        Trigger Thought (Recall the English Phrase)
                      </span>
                      <h2 className="text-xl md:text-3xl font-bold text-slate-800 leading-normal max-w-md">
                        {item.context_hint || "No context hint set. Recall target meaning."}
                      </h2>
                    </>
                  ) : (
                    <>
                      <span className="text-xs md:text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wide mb-3">
                        English Expression (Recall the Meaning)
                      </span>
                      <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
                        {item.word_or_phrase}
                      </h2>
                    </>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlip();
                    }}
                    className="mt-12 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold hover:bg-indigo-100 transition-colors shadow-sm"
                  >
                    Click to Reveal Answer
                  </button>
                </div>
              </div>

              {/* Back Face */}
              <div className={`col-start-1 row-start-1 w-full h-full rounded-3xl shadow-xl flex flex-col p-6 md:p-10 rotate-y-180 backface-hidden text-white overflow-y-auto custom-scrollbar ${item.type === 'ACTIVE' ? 'bg-emerald-600 border border-emerald-500' : 'bg-blue-600 border border-blue-500'} ${isFlipped ? 'z-20' : 'pointer-events-none'}`}>
                <div className="flex-1 flex flex-col justify-center space-y-6">
                  
                  {/* Target Phrase */}
                  <div className="text-center pb-4 border-b border-white/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70 mb-1">
                      Target Expression
                    </span>
                    <h2 className="text-2xl md:text-4xl font-black tracking-tight">
                      {item.word_or_phrase}
                    </h2>
                  </div>

                  {/* Definition */}
                  <div className="bg-white/10 p-4 rounded-xl border border-white/10 shadow-inner">
                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80 mb-1 text-yellow-300">
                      Definition
                    </span>
                    <p className="text-sm md:text-base font-semibold leading-relaxed">
                      {item.definition}
                    </p>
                  </div>

                  {/* Context Hint */}
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80 mb-1">
                      {item.type === 'ACTIVE' ? 'Chinese Trigger Scenario' : 'Original Context Sentence'}
                    </span>
                    <p className="text-xs md:text-sm leading-relaxed opacity-95">
                      {item.context_hint}
                    </p>
                  </div>

                </div>
              </div>

            </div>
          </div>

          {/* Controls */}
          <div className="h-auto shrink-0 w-full z-30">
            <div className={`transition-all duration-300 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
              <p className="text-center text-slate-400 text-xs md:text-sm mb-3 font-medium">How difficult was this?</p>
              <div className="grid grid-cols-4 gap-2 md:gap-4">
                <button
                  onClick={() => handleRating(1)}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-white border-b-2 border-slate-200 hover:bg-red-50 transition-all touch-manipulation shadow-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">1</div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Forgot</span>
                </button>
                <button
                  onClick={() => handleRating(2)}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-white border-b-2 border-slate-200 hover:bg-orange-50 transition-all touch-manipulation shadow-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">2</div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Hard</span>
                </button>
                <button
                  onClick={() => handleRating(3)}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-white border-b-2 border-slate-200 hover:bg-blue-50 transition-all touch-manipulation shadow-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">3</div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Good</span>
                </button>
                <button
                  onClick={() => handleRating(4)}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-white border-b-2 border-slate-200 hover:bg-green-50 transition-all touch-manipulation shadow-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm">4</div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Easy</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ReviewSession;