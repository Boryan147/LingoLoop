import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VocabularyItem } from "../types";

const API_KEY = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_GEMINI_API_KEY : undefined;
const ai = new GoogleGenAI({ apiKey: API_KEY || '' });

const checkApiKey = () => {
  if (!API_KEY || API_KEY.trim() === '' || API_KEY === 'undefined') {
    throw new Error("Gemini API key is missing. Please configure VITE_GEMINI_API_KEY in your .env file.");
  }
};

/**
 * Safely extracts text from Gemini API response objects.
 */
export const extractResponseText = (response: any): string => {
  if (!response) return '';
  try {
    if (typeof response.text === 'string' && response.text.length > 0) {
      return response.text;
    }
  } catch (e) {
    // response.text getter throws if candidate finishReason is not STOP
  }
  const candidate = response?.candidates?.[0];
  if (candidate?.content?.parts) {
    return candidate.content.parts
      .map((part: any) => part.text || '')
      .join('')
      .trim();
  }
  return '';
};

/**
 * Strips markdown code blocks and extracts valid JSON object/array substring.
 */
export const cleanAndParseJSON = (text: string): any => {
  if (!text) return {};
  let cleaned = text.trim();
  
  // Strip markdown code fences (```json ... ``` or ``` ...)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // Extract JSON object or array substring if wrapped in extra text
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1 && lastBracket !== -1) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }

  return JSON.parse(cleaned);
};

const callWithRetry = async <T>(
  fn: (modelName: string) => Promise<T>,
  models: string[] = ['gemini-2.5-flash', 'gemini-1.5-flash'],
  retriesPerModel: number = 2,
  delay: number = 1000
): Promise<T> => {
  checkApiKey();
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= retriesPerModel; attempt++) {
      try {
        return await fn(model);
      } catch (error: any) {
        lastError = error;
        console.warn(`Gemini API call failed using model '${model}' (attempt ${attempt}/${retriesPerModel}):`, error?.message || error);
        if (attempt < retriesPerModel) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
  }

  throw lastError || new Error("Gemini API call failed after retries.");
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
  synonym?: string,
  exactInput: boolean = false
): Promise<IntakeResponse> => {
  try {
    const isPassive = type === 'PASSIVE';
    const contextPart = contextHint ? `Context/Trigger hint provided: "${contextHint}".` : '';
    const synonymPart = synonym 
      ? `The user also provided a synonym they want to associate/compare: "${synonym}". Crucially, compare the main expression and this synonym "${synonym}" in the definition output (e.g. explain the definition of the main expression first, and then add a clear note on when to use one vs the other). Also, return "${synonym}" in the synonyms array, and generate example sentences for each synonym.`
      : 'Do NOT suggest or generate any synonyms. Return an empty array [] in the synonyms field.';

    let systemPrompt = '';
    if (isPassive) {
      systemPrompt = `You are an expert English tutor. The user is capturing a PASSIVE vocabulary item.
         Input expression: "${input}".
         ${contextPart}
         ${synonymPart}
         Provide a clear, simple English explanation (under 35 words).
         Generate exactly 3 natural example sentences for the main expression.
         CRITICAL: If a synonym is provided, also generate 1 natural conversational example sentence for each synonym. Prefix it with "[Synonym: <synonym_word>] " (e.g. "[Synonym: initiate] ...") and append it to the examples array.`;
    } else if (exactInput) {
      systemPrompt = `You are an expert English tutor. The user is capturing an ACTIVE vocabulary item for the exact expression/word: "${input}".
         ${contextPart}
         ${synonymPart}
         
         Instructions:
         1. Do NOT transform or expand the input expression into a full sentence chunk or template. Keep the main word/expression exact: "${input}".
         2. Provide a brief, 1-sentence explanation of its conversational usage, nuance, and scenario (under 35 words).
         3. Generate exactly 3 example sentences showing usage of "${input}" in DIFFERENT conversational tones (Casual/Colloquial, Polite/Professional, and Direct/Emphatic). Prefix each sentence with its tone label, e.g. "[Casual] ...", "[Polite] ...", "[Direct] ...".
         4. CRITICAL: If a synonym is provided, also generate 1 natural conversational example sentence for each synonym. Prefix it with "[Synonym: <synonym_word>] " (e.g. "[Synonym: initiate] ...") and append it to the examples array.`;
    } else {
      systemPrompt = `You are an expert English tutor. The user wants to capture an ACTIVE vocabulary item to learn to speak naturally and effortlessly.
         Input thought/expression to translate (Chinese or simple English): "${input}".
         ${contextPart}
         ${synonymPart}
         
         Instructions:
         1. What is the most authentic, natural, and "brainless" (automatic) spoken expression or sentence chunk for this?
            - CRITICAL: If the input represents a common everyday life concept, scenario, or thought, generate a ready-to-use sentence chunk/template (e.g. "I think this method has some problems", "It's not that big of a deal", or "Let's call it a day") instead of just isolated words or phrases. We want functional, pre-assembled chunks the user can use instantly without constructing sentences in their head.
         2. Provide a brief, 1-sentence explanation of its conversational usage, nuance, and scenario (under 35 words).
         3. Generate exactly 3 example sentences showing usage of the main expression in DIFFERENT conversational tones (Casual/Colloquial, Polite/Professional, and Direct/Emphatic). Prefix each sentence with its tone label, e.g. "[Casual] ...", "[Polite] ...", "[Direct] ...".
         4. CRITICAL: If a synonym is provided, also generate 1 natural conversational example sentence for each synonym. Prefix it with "[Synonym: <synonym_word>] " (e.g. "[Synonym: initiate] ...") and append it to the examples array.`;
    }

    const response = await callWithRetry((model) => ai.models.generateContent({
      model,
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word_or_phrase: { 
              type: Type.STRING, 
              description: (isPassive || exactInput)
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
              description: "Examples showing usage of the main expression (prefixed with tone labels). If a synonym was provided, also include 1 example for each synonym, prefixed with '[Synonym: <synonym_word>]'."
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

    const text = extractResponseText(response);
    const result = cleanAndParseJSON(text);

    return {
      word_or_phrase: result.word_or_phrase || input,
      definition: result.definition || 'Definition unavailable.',
      examples: result.examples || [],
      synonyms: result.synonyms || [],
      word_family: []
    };
  } catch (error: any) {
    console.error("Gemini Intake AI Error:", error);
    const detail = error?.message || "Failed to process with AI.";
    throw new Error(detail);
  }
};

export const formatStoryHTML = (
  rawStory: string,
  targetItems: { word_or_phrase: string; definition?: string; context_hint?: string }[] = []
): string => {
  if (!rawStory) return '';

  let processed = rawStory;

  // 1. Standardize markdown bold syntax (**word**) and <b> tags to <strong>
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/<b>(.*?)<\/b>/gi, '<strong>$1</strong>');

  // 2. Ensure all target items are wrapped in <strong> tags if missing from LLM output
  if (targetItems && targetItems.length > 0) {
    const sortedTargets = [...targetItems].sort(
      (a, b) => b.word_or_phrase.length - a.word_or_phrase.length
    );

    sortedTargets.forEach(item => {
      const phrase = item.word_or_phrase.trim();
      if (!phrase) return;

      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const parts = processed.split(/(<[^>]+>)/g);
      let insideStrong = false;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('<')) {
          if (/<strong/i.test(part)) insideStrong = true;
          if (/<\/strong>/i.test(part)) insideStrong = false;
        } else if (!insideStrong && part.trim().length > 0) {
          // First try exact phrase match
          const exactRegex = new RegExp(`\\b(${escaped})\\b`, 'gi');
          if (exactRegex.test(part)) {
            parts[i] = part.replace(exactRegex, '<strong>$1</strong>');
          } else if (!phrase.includes(' ') && phrase.length > 3) {
            // For single words, try inflection stem matching (e.g. analyze -> analyze/analyzed/analyzing)
            const stem = phrase.replace(/(ing|ed|es|e|s)$/i, '');
            if (stem.length >= 3) {
              const stemEscaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const stemRegex = new RegExp(`\\b(${stemEscaped}[a-z]*)\\b`, 'gi');
              parts[i] = part.replace(stemRegex, '<strong>$1</strong>');
            }
          }
        }
      }

      processed = parts.join('');
    });

    // 3. Fallback Guarantee: If any target item is completely missing from the generated story, append context note
    const plainText = processed.replace(/<[^>]*>/g, '').toLowerCase();

    const missingItems = targetItems.filter(item => {
      const phrase = item.word_or_phrase.trim().toLowerCase();
      if (!phrase) return false;

      if (plainText.includes(phrase)) return false;

      // Check single word stem match in plain text
      if (!phrase.includes(' ') && phrase.length > 3) {
        const stem = phrase.replace(/(ing|ed|es|e|s)$/i, '');
        if (stem.length >= 3 && plainText.includes(stem)) return false;
      }

      // For multi-word phrases, check if key words (>=4 chars) are present
      const words = phrase.split(/\s+/).filter(w => w.length >= 4);
      if (words.length > 0 && words.every(w => plainText.includes(w))) return false;

      return true;
    });

    if (missingItems.length > 0) {
      const fallbackHtml = missingItems.map(item => {
        const def = item.definition ? item.definition.trim() : 'Definition unavailable';
        return `<p class="mt-3 text-slate-700 font-sans italic border-l-2 border-indigo-400 pl-3">Context note: In practice, <strong>${item.word_or_phrase}</strong> means "${def}".</p>`;
      }).join('');

      processed += fallbackHtml;
    }
  }

  return processed;
};

const STORY_STYLES = [
  "Detective & Mystery Investigation (an intriguing noir mystery, detective investigation, or agent debriefing)",
  "Sci-Fi & Cyberpunk World (a futuristic discovery, space station encounter, or AI technology breakthrough)",
  "Workplace Drama & Startup Pitch (a fast-paced team debate, office negotiation, or product demo launch)",
  "Fantasy Expedition & Archeology (exploring ancient temple ruins, unearthing forgotten artifacts, or legendary quests)",
  "Podcast & Live Broadcast Interview (an energetic podcast host interviewing an expert guest on an intriguing topic)",
  "Travel Memoir & Culinary Adventure (exploring vibrant street markets, overseas backpacking, or food tasting)",
  "Humorous & Satirical Comedy (a funny misunderstanding, eccentric characters, or an absurd everyday dilemma)",
  "Late-Night Philosophical Discussion (two close friends sharing deep reflections at a quiet midnight diner)",
  "Documentary & Nature Exploration (a gripping documentary narrator describing wildlife survival or environmental discoveries)"
];

export const generateDailyPassiveContext = async (items: VocabularyItem[]): Promise<string> => {
  try {
    const formattedList = items.map((item, idx) => `${idx + 1}. "${item.word_or_phrase}"`).join('\n');
    const targetWordCount = Math.max(90, items.length * 25);
    const selectedStyle = STORY_STYLES[Math.floor(Math.random() * STORY_STYLES.length)];

    const response = await callWithRetry((model) => ai.models.generateContent({
      model,
      contents: `Write an engaging, creative micro-story or dialogue (around ${targetWordCount} words) incorporating the target words/phrases listed below.

NARRATIVE GENRE & STYLE:
- Genre: ${selectedStyle}
- Make the tone, atmosphere, and dialogue fit this specific genre to create a fresh and immersive reading experience!

TARGET WORDS/PHRASES TO INCLUDE (${items.length} items):
${formattedList}

CRITICAL MANDATES:
1. STRICT REQUIREMENT: You MUST include EVERY SINGLE ONE of the ${items.length} target items listed above in your story/dialogue. DO NOT skip or omit any target word or phrase under any circumstances.
2. Every target word/phrase must appear naturally in context, using either its exact form or a natural grammatical form.
3. Target Audience Level: TOEFL ~100 points / B2 upper-intermediate English learner level.
4. Keep the non-target vocabulary clean, accessible, and standard. Avoid overly archaic or dense literary phrasing.
5. Provide clear surrounding context for each target word so its meaning is easily understood.
6. FORMATTING: Wrap each of the target words/phrases in <strong> tags in the story (e.g., <strong>expression</strong>).`,
    }));
    const rawStory = extractResponseText(response).trim() || "Failed to generate story.";
    return formatStoryHTML(rawStory, items);
  } catch (error: any) {
    console.error("Gemini Micro-Story Error:", error);
    const detail = error?.message || "Failed to generate micro-story.";
    throw new Error(detail);
  }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  try {
    const plainText = text.replace(/<[^>]*>/g, '');
    const response = await callWithRetry((model) => ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: plainText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    }), ['gemini-2.5-flash-preview-tts'], 2, 1000);

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
    const response = await callWithRetry((model) => ai.models.generateContent({
      model,
      contents: `Evaluate the user's sentence for the proper usage of the expression "${wordOrPhrase}".
      User's sentence: "${sentence}"

      EVALUATION RULES:
      1. FOCUS EXCLUSIVELY ON MEANING & USAGE: Check if the user understands and uses "${wordOrPhrase}" properly and meaningfully in context.
      2. DO NOT BE STRICT WITH MINOR SURFACE ERRORS: Ignore minor mechanics like missing initial capital letters, missing commas or periods, or small typos that do not change the core meaning.
      3. "isCorrect": boolean (true if "${wordOrPhrase}" is used appropriately in context, even if there are minor capitalization or punctuation slips).
      4. "feedback": string (A brief, encouraging explanation focused on word usage. Under 30 words).
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

    const text = extractResponseText(response);
    return cleanAndParseJSON(text);
  } catch (error: any) {
    console.error("Gemini Evaluate Sentence Error:", error);
    const detail = error?.message || "Failed to evaluate sentence.";
    throw new Error(detail);
  }
};