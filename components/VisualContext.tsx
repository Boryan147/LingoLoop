import React, { useState, useRef, useEffect } from 'react';
import { analyzeImageForContext, generateSpeech } from '../services/gemini';
import { ImageAnalysisResult } from '../types';
import { Upload, Camera, Loader2, Sparkles, RefreshCw, Volume2, StopCircle, Play } from 'lucide-react';
import InteractiveNarrative from './InteractiveNarrative';

interface VisualContextProps {
  onVocabularyAdded?: () => void;
}

const VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

// Utility to compress high-res mobile photos before sending to API
const compressImage = (base64Str: string, maxWidth = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Export as JPEG with 0.7 quality
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        resolve(base64Str); // Fallback
      }
    };
    img.onerror = () => resolve(base64Str); // Fallback
  });
};

const VisualContext: React.FC<VisualContextProps> = ({ onVocabularyAdded, userId }) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Audio State
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Kore');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Auto-scroll to results on mobile when analysis finishes
  useEffect(() => {
    if (result && resultRef.current) {
      // Small timeout to allow DOM to render
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [result]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setResult(null); // Reset previous result
        stopAudio();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!imagePreview) return;
    setIsAnalyzing(true);
    stopAudio();

    try {
      // Compress image before sending to prevent payload size errors on mobile
      const compressedImage = await compressImage(imagePreview);

      // Extract base64 data and mime type
      const matches = compressedImage.match(/^data:(.+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        setIsAnalyzing(false);
        return;
      }

      const mimeType = matches[1];
      const base64Data = matches[2];

      const analysis = await analyzeImageForContext(base64Data, mimeType);
      setResult(analysis);
    } catch (error) {
      console.error(error);
      alert("Failed to analyze image. It might be too large or the network connection is unstable.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Audio Helpers ---

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const decodeBase64ToArrayBuffer = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const handlePlayAudio = async () => {
    if (isPlaying) {
      stopAudio();
      return;
    }

    if (!result?.narrative) return;

    setIsGeneratingAudio(true);

    try {
      const base64Audio = await generateSpeech(result.narrative, selectedVoice);

      if (!base64Audio) throw new Error("No audio data received");

      // Initialize Audio Context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const ctx = audioContextRef.current;

      // Ensure context is running (browsers suspend it sometimes)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Decode raw PCM
      const arrayBuffer = decodeBase64ToArrayBuffer(base64Audio);
      const dataView = new DataView(arrayBuffer);
      const numChannels = 1;
      const sampleRate = 24000;
      const pcmData = new Int16Array(arrayBuffer);
      const frameCount = pcmData.length;

      const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < frameCount; i++) {
        // Convert Int16 to Float32 [-1.0, 1.0]
        channelData[i] = pcmData[i] / 32768.0;
      }

      // Play
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);

      sourceNodeRef.current = source;
      source.start();
      setIsPlaying(true);

    } catch (error) {
      console.error("Audio Error:", error);
      alert("Failed to generate audio.");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  return (
    // Changed h-full to be conditional. Mobile: scrollable vertically. Desktop: h-full with split scrolling.
    <div className="h-full flex flex-col md:flex-row bg-slate-50 overflow-y-auto md:overflow-hidden">

      {/* Left Panel: Image & Upload */}
      {/* Reduced min-height on mobile to ensure analyze button is easily reachable */}
      <div className="w-full md:w-1/2 p-4 md:p-6 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 shrink-0 md:h-full md:overflow-y-auto">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Camera className="text-indigo-600" /> Think in English
        </h2>

        <div
          className={`
              w-full min-h-[250px] md:min-h-[300px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center relative bg-white transition-all
              ${imagePreview ? 'border-slate-300' : 'border-indigo-300 hover:bg-indigo-50 cursor-pointer'}
            `}
          onClick={() => !imagePreview && fileInputRef.current?.click()}
        >
          {imagePreview ? (
            <>
              <img src={imagePreview} alt="Uploaded context" className="max-h-[300px] md:max-h-full max-w-full object-contain p-2" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setImagePreview(null);
                  setResult(null);
                  stopAudio();
                }}
                className="absolute top-4 right-4 bg-white/90 p-2 rounded-full shadow-md text-slate-600 hover:text-red-500 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="text-center p-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-indigo-600" />
              </div>
              <p className="text-slate-600 font-medium">Click to upload contextual photo</p>
              <p className="text-slate-400 text-sm mt-2">Desk, Living Room, Street view, etc.</p>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!imagePreview || isAnalyzing}
          className="mt-6 w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="animate-spin w-5 h-5" /> Analyzing Scene...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" /> Generate Narrative
            </>
          )}
        </button>
      </div>

      {/* Right Panel: Result */}
      <div
        ref={resultRef}
        className="w-full md:w-1/2 p-4 md:p-6 bg-white md:h-full md:overflow-y-auto pb-24 md:pb-6"
      >
        {!result && !isAnalyzing && (
          <div className="hidden md:flex flex-col items-center justify-center text-center opacity-40 p-10 h-full">
            <Sparkles className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-800">Ready to Learn</h3>
            <p className="text-slate-500 mt-2">Upload an image to see how to describe it in English.</p>
          </div>
        )}

        {isAnalyzing && (
          <div className="space-y-6 animate-pulse mt-4 md:mt-0">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="space-y-3">
              <div className="h-3 bg-slate-100 rounded w-full"></div>
              <div className="h-3 bg-slate-100 rounded w-full"></div>
              <div className="h-3 bg-slate-100 rounded w-5/6"></div>
            </div>
            <div className="h-32 bg-slate-100 rounded-xl"></div>
          </div>
        )}

        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
                <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest block">Internal Monologue</span>

                {/* Audio Controls */}
                <div className="flex w-full md:w-auto items-center gap-2 bg-slate-100 p-1 rounded-lg">
                  <select
                    value={selectedVoice}
                    onChange={(e) => {
                      stopAudio();
                      setSelectedVoice(e.target.value);
                    }}
                    disabled={isPlaying || isGeneratingAudio}
                    className="flex-1 md:flex-none bg-white text-xs font-medium text-slate-600 py-2 md:py-1 px-2 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>

                  <button
                    onClick={handlePlayAudio}
                    disabled={isGeneratingAudio}
                    className={`p-2 md:p-1.5 rounded-md transition-all ${isPlaying
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                      }`}
                  >
                    {isGeneratingAudio ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isPlaying ? (
                      <StopCircle className="w-4 h-4" />
                    ) : (
                      <div className="flex items-center gap-1">
                        <Play className="w-3 h-3 fill-current" />
                        <span className="text-[10px] font-bold pr-1">LISTEN</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Interactive Narrative Component */}
              <div className="bg-slate-50/50 rounded-xl p-2 md:p-0">
                <InteractiveNarrative
                  text={result.narrative}
                  onVocabularyAdded={() => onVocabularyAdded && onVocabularyAdded()}
                  userId={userId}
                />           </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> Key Vocabulary
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.vocabulary.map((word, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm font-medium shadow-sm select-all"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-8 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm">
              <strong>Tip:</strong> Try to read the monologue aloud while looking at the picture to reinforce the association between the visual cues and the English phrases.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualContext;