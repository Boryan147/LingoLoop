import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2, Play, AlertCircle, Save, CheckCircle2, MessageSquareText } from 'lucide-react';
import { analyzeAudioFeedback } from '../services/gemini';
import { FeedbackResult } from '../types';

const SpeakingPractice: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const actualMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        // Gemini API expects "audio/webm" without the ";codecs=opus" part
        const cleanMimeType = actualMimeType.split(';')[0] || 'audio/webm';
        
        const audioBlob = new Blob(audioChunksRef.current, { type: cleanMimeType });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result?.toString().split(',')[1];
          if (base64data) {
            await handleAnalyze(base64data, cleanMimeType);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
      setFeedback(null);
      setAudioUrl(null);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      setError("Please allow microphone access to record.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleAnalyze = async (base64Audio: string, mimeType: string) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeAudioFeedback(base64Audio, mimeType);
      setFeedback(result);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze audio. Please check API key or try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto h-full flex flex-col overflow-y-auto pb-20">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Speaking Practice</h2>
        <p className="text-slate-500 mt-2 text-lg">Record a summary of a topic you learned. Get AI feedback on grammar, vocabulary, and native expression.</p>
      </div>

      {/* Recording Section */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col items-center justify-center mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <MessageSquareText className="w-32 h-32 text-indigo-500" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center text-center">
          {isRecording ? (
            <div className="mb-6 flex flex-col items-center">
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center animate-pulse mb-4 shadow-xl shadow-red-100">
                <Mic className="w-10 h-10 text-red-600 animate-bounce" />
              </div>
              <p className="text-red-500 font-semibold mb-6">Recording in progress...</p>
              <button 
                onClick={stopRecording}
                className="bg-red-600 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-red-700 transition-all shadow-lg hover:shadow-red-200"
              >
                <Square className="w-5 h-5 fill-current" /> Stop & Analyze
              </button>
            </div>
          ) : (
            <div className="mb-6 flex flex-col items-center">
              <div className="w-24 h-24 bg-indigo-50 border-4 border-indigo-100 rounded-full flex items-center justify-center mb-4">
                <Mic className="w-10 h-10 text-indigo-400" />
              </div>
              <p className="text-slate-500 mb-6 font-medium">Ready when you are!</p>
              <button 
                onClick={startRecording}
                disabled={isAnalyzing}
                className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                <Mic className="w-5 h-5" /> Start Recording
              </button>
            </div>
          )}

          {audioUrl && !isRecording && (
            <div className="w-full max-w-md mt-6 bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center">
              <audio src={audioUrl} controls className="w-full h-10" />
            </div>
          )}

          {error && (
            <div className="mt-4 text-red-500 bg-red-50 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium border border-red-100">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {isAnalyzing && (
            <div className="mt-8 flex flex-col items-center text-indigo-600">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="font-semibold animate-pulse">Analyzing your stunning speech...</p>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Section */}
      {feedback && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <MessageSquareText className="w-5 h-5 text-indigo-500" /> Your Transcription
            </h3>
            <p className="text-slate-700 bg-slate-50 p-4 rounded-xl leading-relaxed italic text-lg border-l-4 border-indigo-400 font-serif">
              "{feedback.transcription}"
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-red-100">
              <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Grammar Polish
              </h3>
              {feedback.grammarCorrections && feedback.grammarCorrections.length > 0 ? (
                <div className="space-y-4">
                  {feedback.grammarCorrections.map((g, i) => (
                    <div key={i} className="bg-red-50 p-4 rounded-2xl">
                      <div className="flex gap-2 items-start mb-2">
                        <span className="line-through text-red-400 font-medium text-sm mt-0.5">{g.original}</span>
                        <span className="text-red-700 font-bold bg-white px-2 py-0.5 rounded-md shadow-sm text-sm">{g.corrected}</span>
                      </div>
                      <p className="text-red-600/80 text-xs mt-1 leading-snug">{g.explanation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-emerald-600 flex items-center gap-2 font-medium bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5" /> Spotless grammar!
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-amber-100">
              <h3 className="text-lg font-bold text-amber-800 mb-4 flex items-center gap-2">
                <Play className="w-5 h-5" /> Vocabulary Upgrades
              </h3>
              {feedback.vocabularyUpgrades && feedback.vocabularyUpgrades.length > 0 ? (
                <div className="space-y-4">
                  {feedback.vocabularyUpgrades.map((v, i) => (
                    <div key={i} className="bg-amber-50 p-4 rounded-2xl">
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-2">
                        <span className="text-amber-600/70 font-mono text-sm">{v.word}</span>
                        <span className="text-amber-400 mx-1 hidden sm:inline">→</span>
                        <span className="text-amber-800 font-bold text-lg bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200">{v.suggestion}</span>
                      </div>
                      <p className="text-amber-700/80 text-xs mt-1">{v.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-amber-600 p-3 bg-amber-50 rounded-xl text-sm border border-amber-100">Great vocabulary usage.</p>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-6 md:p-8 shadow-md text-white">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-50">
              <SparklesIcon className="w-5 h-5 text-indigo-200" /> Native Speaker Notes
            </h3>
            <ul className="space-y-3">
              {feedback.nativeSuggestions?.map((s, i) => (
                <li key={i} className="flex items-start gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0" />
                  <p className="text-indigo-50 font-medium leading-snug">{s}</p>
                </li>
              ))}
            </ul>
          </div>
          
        </div>
      )}
    </div>
  );
};

const SparklesIcon = (props: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 3v3m0 12v3M3 12h3m12 0h3M7.05 7.05l2.12 2.12m9.9 9.9l-2.12-2.12M7.05 16.95l2.12-2.12m9.9-9.9l-2.12 2.12" />
  </svg>
);

export default SpeakingPractice;
