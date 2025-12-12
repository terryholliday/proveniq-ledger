import { GoogleGenAI } from "@google/genai";
import { Block } from '../types';

const callGemini = async (prompt: string): Promise<string> => {
     if (!process.env.API_KEY) {
        throw new Error("API Key is not configured. Please set the API_KEY environment variable.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    if (response.text) {
        return response.text;
    } else {
        throw new Error("The AI assistant did not provide a response.");
    }
}

export const getAIAssistantResponse = async (ledger: Block[], question: string): Promise<string> => {
    try {
        const prompt = `You are a professional audit assistant for Proveniq Ledger. Your role is to analyze an immutable claims ledger and answer questions with precision and clarity. You must answer ONLY based on the provided JSON data. Do not invent information or make assumptions. If the answer cannot be found in the data, state that clearly. Be concise and professional in your response.

Here is the complete, cryptographically linked ledger data:
\`\`\`json
${JSON.stringify(ledger, null, 2)}
\`\`\`

User's Question: "${question}"`;
        return await callGemini(prompt);
    } catch (error) {
        console.error("Error calling Gemini API for assistant:", error);
        return `An error occurred while contacting the AI assistant: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
};

export const getAISummary = async (block: Block): Promise<string> => {
     try {
        const prompt = `You are a professional insurance auditor. Based on the following transaction data for a single claim, write a concise, professional summary of the claim's lifecycle. Highlight key events, the user responsible for them, and the final resolution if present. Start with a clear headline.

Claim Data:
\`\`\`json
${JSON.stringify(block, null, 2)}
\`\`\`

Generate the summary.`;
        return await callGemini(prompt);
    } catch (error) {
        console.error("Error calling Gemini API for summary:", error);
        return `An error occurred while generating the summary: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}
