import { GoogleGenAI, Type } from "@google/genai";
import { Block, Anomaly, FraudScore } from '../types';

// Helper to safely parse JSON from Gemini response
const parseGeminiJson = <T>(text: string | undefined, fallback: T): T => {
    if (!text) return fallback;
    try {
        // The API might return the JSON wrapped in markdown-style code blocks.
        const jsonText = text.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        return JSON.parse(jsonText) as T;
    } catch (e) {
        console.error("Failed to parse JSON from Gemini response:", text, e);
        return fallback;
    }
};

const callGeminiWithSchema = async <T>(prompt: string, schema: any, fallback: T): Promise<T> => {
    if (!process.env.API_KEY) {
        console.error("API Key is not configured.");
        return fallback;
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });
        return parseGeminiJson(response.text, fallback);
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return fallback;
    }
};

export const detectAnomalies = async (ledger: Block[]): Promise<Anomaly[]> => {
    const prompt = `You are a fraud detection expert analyzing an insurance claims ledger. Based on the provided ledger data, identify any claims (blocks) that exhibit anomalous patterns. Common anomalies include: payments issued extremely quickly after claim creation, an unusually high number of documents uploaded in a short time, or claim creation outside of normal business hours. Provide your findings as a JSON object.

Ledger Data:
\`\`\`json
${JSON.stringify(ledger, null, 2)}
\`\`\`
`;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            anomalies: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        blockId: { type: Type.STRING },
                        reason: { type: Type.STRING },
                    },
                    required: ["blockId", "reason"]
                }
            }
        }
    };

    const result = await callGeminiWithSchema<{ anomalies: Anomaly[] }>(prompt, schema, { anomalies: [] });
    return result.anomalies;
};


export const calculateFraudScores = async (ledger: Block[]): Promise<FraudScore[]> => {
    const prompt = `You are a predictive risk assessment model for an insurance company. For each claim (block) in the provided ledger, calculate a fraud risk score from 0 to 100. Assign a risk level ('Low', 'Medium', 'High') and provide a brief justification. A high score might be justified by factors like high claim value combined with minimal documentation, rapid progression to payment, or multiple revisions.

Ledger Data:
\`\`\`json
${JSON.stringify(ledger, null, 2)}
\`\`\`
`;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            scores: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        blockId: { type: Type.STRING },
                        score: { type: Type.INTEGER },
                        level: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                        justification: { type: Type.STRING }
                    },
                     required: ["blockId", "score", "level", "justification"]
                }
            }
        }
    };
    
    const result = await callGeminiWithSchema<{ scores: FraudScore[] }>(prompt, schema, { scores: [] });
    return result.scores;
};
