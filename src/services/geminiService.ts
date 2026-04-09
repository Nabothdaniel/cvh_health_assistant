import { GoogleGenAI, Type } from "@google/genai";
import { SymptomCheck, DiagnosisResult, MalnutritionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getDiagnosis(symptoms: SymptomCheck): Promise<DiagnosisResult> {
  const prompt = `You are an AI clinical decision-support assistant for trained Community Health Volunteers in rural Africa.
    Your job is to provide FAST, SAFE, and ACTIONABLE triage decisions.

    INPUT:
    - Fever: ${symptoms.fever ? 'yes' : 'no'}
    - Cough: ${symptoms.cough ? 'yes' : 'no'}
    - Difficulty breathing: ${symptoms.difficultyBreathing ? 'yes' : 'no'}
    - Age: ${symptoms.age}

    RULES:
    - Fever without cough -> Malaria likely
    - Cough + difficulty breathing -> Pneumonia likely
    - Child + difficulty breathing -> Emergency
    - Always prioritize life-threatening conditions
    - If uncertain -> mark Confidence as Low and recommend referral

    CONSTRAINTS:
    - No long explanations
    - No medical jargon
    - Max 20 words per field

    Provide the response in JSON format.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          likelyDiagnosis: { type: Type.STRING, description: "One likely condition" },
          severity: { type: Type.STRING, enum: ["Mild", "Urgent", "Emergency"] },
          confidence: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
          recommendedAction: { type: Type.STRING, description: "Clear, immediate next step" }
        },
        required: ["likelyDiagnosis", "severity", "confidence", "recommendedAction"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function analyzeMalnutrition(imageBase64: string): Promise<MalnutritionResult> {
  const prompt = `Analyze this image of a child for visible signs of malnutrition.
    Look for:
    - Very thin arms or legs
    - Swollen abdomen
    - Hair discoloration
    - Weak posture

    OUTPUT:
    - Risk Level: Low | Medium | High
    - Confidence: Low | Medium | High
    - Action: simple recommendation

    Keep response short and practical. Provide the response in JSON format.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64.split(',')[1] || imageBase64
        }
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          riskLevel: { type: Type.STRING, enum: ["Low", "Moderate", "High"] },
          confidence: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
          advice: { type: Type.STRING },
          observations: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["riskLevel", "confidence", "advice", "observations"]
      }
    }
  });

  return JSON.parse(response.text);
}
