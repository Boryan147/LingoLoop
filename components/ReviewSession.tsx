import React, { useState, useEffect } from 'react';
import { VocabularyItem } from '../types';
import { calculateNextReview } from '../services/srs';
import * as storage from '../services/storage';
import { PartyPopper, Lightbulb } from 'lucide-react';

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
    const currentItem = queue[currentIndex];
    const updates = calculateNextReview(currentItem, rating);
    const updatedItem = { ...currentItem, ...updates };

    await storage.updateItem(updatedItem, userId);

    if (currentIndex < queue.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
    } else {
      setCompleted(true);
    }
  };

  const handleFlip = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isFlipped) {
      setIsFlipped(true);
    }
  };

  const highlightMatch = (text: string, term: string) => {
    if (!term.trim() || !text) return text;
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');

    return text.split(regex).map((part, i) =>
      part.toLowerCase() === term.toLowerCase() ?
        <span key={i} className="font-extrabold text-yellow-300 bg-white/10 px-1 rounded mx-0.5">{part}</span> :
        part
    );
  };

  if (queue.length === 0 && !completed) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <PartyPopper className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">All Caught Up!</h2>
        <p className="text-slate-500 mb-8">You have no pending reviews for now.</p>
        <button
          onClick={onComplete}
          className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in zoom-in-95 duration-300">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Session Complete!</h2>
        <p className="text-slate-500 mb-8">You reviewed {queue.length} items.</p>
        <button
          onClick={onComplete}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          Finish
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
          <div className="flex justify-between text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider shrink-0">
            <span>Review Session</span>
            <span>{currentIndex + 1} / {queue.length}</span>
          </div>

          {/* Flashcard Area */}
          {/* Using flex-1 to fill available space, with min-height safety */}
          <div className="flex-1 relative perspective-1000 min-h-[60vh] md:min-h-[400px] mb-6 group">
            {/* Using Grid for stacking faces instead of absolute positioning to prevent height collapse */}
            <div className={`relative w-full h-full transition-all duration-500 transform-style-3d grid grid-cols-1 grid-rows-1 ${isFlipped ? 'rotate-y-180' : ''}`}>

              {/* Front Face */}
              <div
                className={`col-start-1 row-start-1 w-full h-full bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col p-4 md:p-10 backface-hidden cursor-pointer hover:shadow-2xl transition-all overflow-y-auto custom-scrollbar ${isFlipped ? 'pointer-events-none' : 'z-20'}`}
                onClick={handleFlip}
              >
                <div className="flex-1 flex flex-col items-center justify-center min-h-min">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 md:mb-6 shrink-0">
                    <Lightbulb className="w-6 h-6 md:w-8 md:h-8 text-indigo-500" />
                  </div>
                  <span className="text-xs md:text-sm font-bold text-slate-400 mb-2 uppercase tracking-wide shrink-0">Expression</span>

                  <h2 className="text-xl md:text-4xl font-bold text-slate-900 text-center mb-8 leading-snug break-words max-w-full">
                    {item.expression}
                  </h2>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlip();
                    }}
                    className="mt-auto md:mt-4 px-6 py-2 md:px-8 md:py-3 bg-indigo-50 text-indigo-600 rounded-full text-xs md:text-sm font-bold hover:bg-indigo-100 transition-colors shadow-sm shrink-0"
                  >
                    Click to Reveal Meaning
                  </button>
                </div>
              </div>

              {/* Back Face */}
              {/* Note: rotate-y-180 is needed here to orient the back face correctly in the 3D space */}
              <div className={`col-start-1 row-start-1 w-full h-full bg-indigo-600 rounded-3xl shadow-xl flex flex-col p-5 md:p-8 rotate-y-180 backface-hidden text-white overflow-y-auto custom-scrollbar ${isFlipped ? 'z-20' : 'pointer-events-none'}`}>
                <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 border-b border-indigo-500 pb-4 text-center opacity-80 shrink-0 break-words">{item.expression}</h3>

                <div className="space-y-4 md:space-y-6 flex-1">
                  <div className="bg-indigo-700/50 p-4 rounded-xl border border-indigo-500/30 shadow-inner">
                    <span className="text-indigo-200 text-[10px] md:text-xs font-bold uppercase block mb-1 tracking-wider">
                      Meaning
                    </span>
                    <p className="text-base md:text-xl font-medium leading-relaxed text-white">
                      {item.definition}
                    </p>
                  </div>

                  <div>
                    <span className="text-indigo-300 text-[10px] md:text-xs font-bold uppercase block mb-1">Context Scenario</span>
                    <p className="text-sm text-indigo-50 leading-relaxed bg-indigo-800/30 p-3 rounded-lg border border-indigo-500/20">
                      {highlightMatch(item.scenario, item.expression)}
                    </p>
                  </div>

                  <div>
                    <span className="text-indigo-300 text-[10px] md:text-xs font-bold uppercase block mb-1">Examples</span>
                    <ul className="list-none space-y-2">
                      {item.examples && item.examples.length > 0 ? (
                        item.examples.map((ex, i) => (
                          <li key={i} className="text-xs md:text-sm text-indigo-100 pl-3 border-l-2 border-indigo-400/50 italic">
                            "{highlightMatch(ex, item.expression)}"
                          </li>
                        ))
                      ) : (
                        <li className="text-sm italic opacity-50">No examples available.</li>
                      )}
                    </ul>
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
                  className="flex flex-col items-center justify-center gap-1 md:gap-2 p-2 md:p-3 rounded-xl bg-white border-b-2 md:border-b-4 border-slate-200 active:border-b-0 active:translate-y-0.5 hover:bg-red-50 transition-all touch-manipulation"
                >
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm md:text-lg">1</div>
                  <span className="text-[10px] md:text-xs font-bold text-slate-600 uppercase tracking-tight">Forgot</span>
                </button>
                <button
                  onClick={() => handleRating(3)}
                  className="flex flex-col items-center justify-center gap-1 md:gap-2 p-2 md:p-3 rounded-xl bg-white border-b-2 md:border-b-4 border-slate-200 active:border-b-0 active:translate-y-0.5 hover:bg-orange-50 transition-all touch-manipulation"
                >
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm md:text-lg">2</div>
                  <span className="text-[10px] md:text-xs font-bold text-slate-600 uppercase tracking-tight">Hard</span>
                </button>
                <button
                  onClick={() => handleRating(4)}
                  className="flex flex-col items-center justify-center gap-1 md:gap-2 p-2 md:p-3 rounded-xl bg-white border-b-2 md:border-b-4 border-slate-200 active:border-b-0 active:translate-y-0.5 hover:bg-blue-50 transition-all touch-manipulation"
                >
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm md:text-lg">3</div>
                  <span className="text-[10px] md:text-xs font-bold text-slate-600 uppercase tracking-tight">Good</span>
                </button>
                <button
                  onClick={() => handleRating(5)}
                  className="flex flex-col items-center justify-center gap-1 md:gap-2 p-2 md:p-3 rounded-xl bg-white border-b-2 md:border-b-4 border-slate-200 active:border-b-0 active:translate-y-0.5 hover:bg-green-50 transition-all touch-manipulation"
                >
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm md:text-lg">4</div>
                  <span className="text-[10px] md:text-xs font-bold text-slate-600 uppercase tracking-tight">Easy</span>
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