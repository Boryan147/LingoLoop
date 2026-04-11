import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ImageAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const generateExpressionContext = async (expression: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate study material for the English expression: "${expression}". 
      Return a JSON object strictly matching this schema:
      {
        "definition": "Clear and concise definition in English",
        "partOfSpeech": "e.g., noun, verb, adjective, phrase",
        "phonetic": "International Phonetic Alphabet (IPA) representation",
        "verbForms": "For verbs, include forms like 'do, did, done'. For non-verbs, leave as empty string or omit.",
        "examples": ["Sentence 1", "Sentence 2", "Sentence 3", "Sentence 4"],
        "synonyms": [{"word": "synonym 1", "intensity": 1-10, "formality": 1-10}],
        "collocations": {"verbs": ["verb1", "verb2"], "adjectives": ["adj1", "adj2"]},
        "scenario": "A short, engaging paragraph (approx 3-4 sentences) describing a realistic daily life situation where this expression is used naturally."
      }
      IMPORTANT: Provide at least 3-4 distinct example sentences demonstrating different usages if possible. Ensure synonyms are graded (intensity and formality from 1-10).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            definition: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            phonetic: { type: Type.STRING },
            verbForms: { type: Type.STRING },
            examples: { type: Type.ARRAY, items: { type: Type.STRING } },
            synonyms: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: { word: { type: Type.STRING }, intensity: { type: Type.INTEGER }, formality: { type: Type.INTEGER } },
                required: ["word", "intensity", "formality"] 
              } 
            },
            collocations: { 
              type: Type.OBJECT, 
              properties: { verbs: { type: Type.ARRAY, items: { type: Type.STRING } }, adjectives: { type: Type.ARRAY, items: { type: Type.STRING } } },
              required: ["verbs", "adjectives"] 
            },
            scenario: { type: Type.STRING },
          },
          required: ["definition", "partOfSpeech", "phonetic", "examples", "synonyms", "collocations", "scenario"],
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Expression Error:", error);
    throw new Error("Failed to generate context.");
  }
};

export const getQuickDefinition = async (text: string, context: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a simple, concise English definition for the word or phrase "${text}" as it is used in this context: "${context}". 
      Keep it under 20 words.`,
    });
    return response.text?.trim() || "Definition unavailable.";
  } catch (error) {
    console.error("Gemini Definition Error:", error);
    return "Could not retrieve definition.";
  }
};

export const analyzeImageForContext = async (base64Image: string, mimeType: string): Promise<ImageAnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType
            }
          },
          {
            text: `Analyze this image to help an English learner "think in English".
            1. Write a first-person narrative (approx 80-100 words) describing the scene as if you are there, interacting with the objects (e.g., "I sit at the desk...", "I see a..."). It should sound like inner monologue or a diary entry.
            2. List 5-8 key vocabulary words visible in the image that are relevant to the narrative.
            
            Return JSON.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            vocabulary: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["narrative", "vocabulary"],
        }
      }
    });

    return JSON.parse(response.text || '{}') as ImageAnalysisResult;
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw new Error("Failed to analyze image.");
  }
};

export const generateSpeech = async (text: string, voiceName: string = 'Kore') => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    // Return the base64 encoded audio string
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw new Error("Failed to generate speech.");
  }
};

export const generateScenarioExpressions = async (scenario: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `For the following real-life scenario: "${scenario}", provide a list of 5-8 key English expressions, idioms, or phrases that are most commonly used and essential for the person in that situation.
      Return a JSON array of objects strictly matching this schema:
      {
        "expressions": [
          {
            "expression": "The phrase",
            "definition": "Clear and concise definition in English",
            "partOfSpeech": "phrase, idiom, etc.",
            "phonetic": "IPA representation",
            "verbForms": "Only if applicable",
            "examples": ["Sentence 1", "Sentence 2"]
          }
        ]
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            expressions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  expression: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  partOfSpeech: { type: Type.STRING },
                  phonetic: { type: Type.STRING },
                  verbForms: { type: Type.STRING },
                  examples: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["expression", "definition", "partOfSpeech", "phonetic", "examples"],
              }
            }
          },
          required: ["expressions"],
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return parsed.expressions || [];
  } catch (error) {
    console.error("Gemini Scenario Error:", error);
    throw new Error("Failed to generate scenario expressions.");
  }
};

export const analyzeAudioFeedback = async (base64Audio: string, mimeType: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType
            }
          },
          {
            text: `Transcribe this audio, then analyze it for English learners.
            Return a JSON object with:
            1. "transcription": The exact transcription of the audio.
            2. "grammarCorrections": Array of objects { "original": text, "corrected": text, "explanation": text } capturing any grammatical errors.
            3. "vocabularyUpgrades": Array of objects { "word": bad/basic word used, "suggestion": better word, "reason": why } identifying "low-level" word choices.
            4. "nativeSuggestions": Array of strings providing overall suggestions from a native speaker perspective to sound more natural.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: { type: Type.STRING },
            grammarCorrections: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: { original: { type: Type.STRING }, corrected: { type: Type.STRING }, explanation: { type: Type.STRING } },
                required: ["original", "corrected", "explanation"]
              } 
            },
            vocabularyUpgrades: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: { word: { type: Type.STRING }, suggestion: { type: Type.STRING }, reason: { type: Type.STRING } },
                required: ["word", "suggestion", "reason"]
              } 
            },
            nativeSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["transcription", "grammarCorrections", "vocabularyUpgrades", "nativeSuggestions"],
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Audio Feedback Error:", error);
    throw new Error("Failed to analyze audio.");
  }
};