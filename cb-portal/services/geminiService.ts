
import { GoogleGenAI } from "@google/genai";
import { DisputeRecord } from "../types";

// Safety declaration for client-side environments
declare var process: any;

export const analyzeAnomalies = async (anomalies: DisputeRecord[]) => {
  if (anomalies.length === 0) return "No anomalies to analyze.";

  // According to guidelines, assume process.env.API_KEY is available and valid.
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.warn("API Key is missing. Skipping AI analysis.");
    return "AI Analysis unavailable: API Key not configured.";
  }

  // Initialize GenAI client
  const ai = new GoogleGenAI({ apiKey });

  // Create a concise context. Limit data to avoid token overflow.
  const sampleData = anomalies.slice(0, 50).map(a => ({
    merchant: a.merchant,
    ref: a.caseReference,
    reason: a.reasonCode,
    category: a.reasonCategory,
    amount: a.transactionAmount,
    date: a.transactionDate
  }));
  
  const dataContext = JSON.stringify(sampleData);

  const prompt = `
    You are a specialized financial dispute analyst. 
    I have performed a delta check between two dispute databases and identified ${anomalies.length} NEW unique cases that appeared in the updated sheet but were not in the original.

    Here is a sample of the new data (limited to first 50 for brevity):
    ${dataContext}
    
    Please provide a professional executive summary in Markdown format:
    1. **Overview**: State the total count of new anomalies (${anomalies.length}).
    2. **Financial Impact**: Calculate or estimate the total value of these new disputes based on the sample transaction amounts.
    3. **Merchant Patterns**: Are specific merchants appearing frequently?
    4. **Reason Patterns**: Analyze the Reason Codes and Categories. What is the primary cause of disputes?
    5. **Action Items**: Suggest specific operational steps to handle these new incoming disputes.
    
    Format the output clearly with bold headers and bullet points.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text || "Analysis generated, but returned empty content.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "An error occurred while generating the AI analysis. Please try again.";
  }
};
