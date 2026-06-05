import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const generateDefinition = async (
  wordOrPhrase: string,
  type: 'ACTIVE' | 'PASSIVE',
  contextHint?: string
): Promise<string> => {
  try {
    const contextPart = contextHint ? `Here is the context/original sentence: "${contextHint}".` : '';
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a simple, concise, and clear English definition for the target word/phrase: "${wordOrPhrase}".
      This is for a vocabulary list where the type is "${type}". 
      ${type === 'ACTIVE' ? 'ACTIVE: Expressions the user wants to use in daily speech/thought.' : 'PASSIVE: Advanced words/phrases the user only needs to recognize.'}
      ${contextPart}
      Provide ONLY the definition itself, under 25 words. Do not include quotes or labels.`,
    });
    return response.text?.trim() || "Definition unavailable.";
  } catch (error) {
    console.error("Gemini Definition Generation Error:", error);
    throw new Error("Failed to generate definition. Check your API key or connection.");
  }
};

export const evaluateSentence = async (wordOrPhrase: string, sentence: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Evaluate Sentence Error:", error);
    throw new Error("Failed to evaluate sentence.");
  }
};