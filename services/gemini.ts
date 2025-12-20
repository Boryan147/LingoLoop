import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ImageAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateExpressionContext = async (expression: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate study material for the English expression: "${expression}". 
      Return a JSON object strictly matching this schema:
      {
        "definition": "Clear and concise definition in English",
        "examples": ["Sentence 1", "Sentence 2", "Sentence 3", "Sentence 4"],
        "scenario": "A short, engaging paragraph (approx 3-4 sentences) describing a realistic daily life situation where this expression is used naturally."
      }
      IMPORTANT: Provide at least 3-4 distinct example sentences demonstrating different usages if possible.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            definition: { type: Type.STRING },
            examples: { type: Type.ARRAY, items: { type: Type.STRING } },
            scenario: { type: Type.STRING },
          },
          required: ["definition", "examples", "scenario"],
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