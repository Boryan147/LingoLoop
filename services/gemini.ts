import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VocabularyItem } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const callWithRetry = async <T>(fn: () => Promise<T>, retries: number = 3, delay: number = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 1) {
      throw error;
    }
    console.warn(`Gemini call failed, retrying in ${delay}ms...`, error);
    await new Promise(resolve => setTimeout(resolve, delay));
    return callWithRetry(fn, retries - 1, delay * 2);
  }
};

export interface IntakeResponse {
  word_or_phrase: string;
  definition: string;
  examples: string[];
  synonyms: string[];
  word_family: string[];
}

export const generateIntakeAI = async (
  input: string,
  type: 'ACTIVE' | 'PASSIVE',
  contextHint?: string,
  synonym?: string
): Promise<IntakeResponse> => {
  try {
    const isPassive = type === 'PASSIVE';
    const contextPart = contextHint ? `Context/Trigger hint provided: "${contextHint}".` : '';
    const synonymPart = synonym 
      ? `The user also provided a synonym they want to associate/compare: "${synonym}". Crucially, compare the main expression and this synonym "${synonym}" in the definition output (e.g. explain the definition of the main expression first, and then add a clear note on when to use one vs the other). Also, return "${synonym}" in the synonyms array.`
      : 'Do NOT suggest or generate any synonyms. Return an empty array [] in the synonyms field.';

    const systemPrompt = isPassive
      ? `You are an expert English tutor. The user is capturing a PASSIVE vocabulary item.
         Input expression: "${input}".
         ${contextPart}
         ${synonymPart}
         Provide a clear, simple English explanation (under 35 words) and 3 natural example sentences.`
      : `You are an expert English tutor. The user wants to capture an ACTIVE vocabulary item to learn to speak naturally and effortlessly.
         Input thought/expression to translate (Chinese or simple English): "${input}".
         ${contextPart}
         ${synonymPart}
         
         Instructions:
         1. What is the most authentic, natural, and "brainless" (automatic) spoken expression or sentence chunk for this?
            - CRITICAL: If the input represents a common everyday life concept, scenario, or thought, generate a ready-to-use sentence chunk/template (e.g. "I think this method has some problems", "It's not that big of a deal", or "Let's call it a day") instead of just isolated words or phrases. We want functional, pre-assembled chunks the user can use instantly without constructing sentences in their head.
         2. Provide a brief, 1-sentence explanation of its conversational usage, nuance, and scenario (under 35 words).
         3. Generate exactly 3 example sentences showing usage in DIFFERENT conversational tones (Casual/Colloquial, Polite/Professional, and Direct/Emphatic). Prefix each sentence with its tone label, e.g. "[Casual] ...", "[Polite] ...", "[Direct] ...".`;

    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word_or_phrase: { 
              type: Type.STRING, 
              description: isPassive 
                ? "Return the input word/phrase exactly as provided" 
                : "The authentic spoken English expression, idiom, or sentence chunk matching the input thought (prefer full ready-to-use sentence chunks for common concepts)"
            },
            definition: { 
              type: Type.STRING, 
              description: "A clear, simple English explanation of the nuance and conversational usage. If a synonym was provided, include a brief comparison note explaining the nuance difference between them." 
            },
            examples: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Exactly three natural spoken example sentences showing usage with different conversational tones (Casual, Polite/Professional, Direct), prefixed with their tone label, e.g., '[Casual] This is a test.'"
            },
            synonyms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "If a synonym was provided, return it in this array (e.g. ['synonym_word']). Otherwise, return an empty array []."
            }
          },
          required: ["word_or_phrase", "definition", "examples", "synonyms"]
        }
      }
    }));

    const result = JSON.parse(response.text || '{}');
    return {
      word_or_phrase: result.word_or_phrase || input,
      definition: result.definition || 'Definition unavailable.',
      examples: result.examples || [],
      synonyms: result.synonyms || [],
      word_family: []
    };
  } catch (error) {
    console.error("Gemini Intake AI Error:", error);
    throw new Error("Failed to process with AI. Check connection or API key.");
  }
};

export const generateDailyPassiveContext = async (items: VocabularyItem[]): Promise<string> => {
  try {
    const wordsList = items.map(item => item.word_or_phrase).join(', ');
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a short, engaging, and cohesive micro-story or dialogue (under 100 words) using these specific words naturally: ${wordsList}.
      IMPORTANT: Wrap each of the target words/phrases in <strong> tags in the story. Keep it natural and simple for learning.`,
    }));
    return response.text?.trim() || "Failed to generate story.";
  } catch (error) {
    console.error("Gemini Micro-Story Error:", error);
    throw new Error("Failed to generate micro-story.");
  }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  try {
    // Strip HTML tags for clean TTS
    const plainText = text.replace(/<[^>]*>/g, '');
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: plainText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return undefined; // Handled gracefully by falling back to browser speech synthesis
  }
};

export const playBrowserSpeech = (text: string) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const plainText = text.replace(/<[^>]*>/g, '');
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  }
  return false;
};

export const evaluateSentence = async (wordOrPhrase: string, sentence: string) => {
  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Evaluate the user's sentence for the proper usage of the expression "${wordOrPhrase}".
      User's sentence: "${sentence}"
      Return a JSON object with:
      1. "isCorrect": boolean (true if the expression is used correctly and the sentence is grammatically correct).
      2. "feedback": string (A brief explanation of why it's right or wrong. If wrong, provide a corrected version of their sentence).
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
          },
          required: ["isCorrect", "feedback"],
        }
      }
    }));

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Evaluate Sentence Error:", error);
    throw new Error("Failed to evaluate sentence.");
  }
};