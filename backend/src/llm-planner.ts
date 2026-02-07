/**
 * LLM-based routing planner using Gemini Flash
 * Alternative to RegExp-based routing in dispatcher.ts
 */

import { SpecialistType } from './types';

interface PlanningResult {
  specialist: SpecialistType;
  confidence: number;
  reasoning: string;
}

/**
 * Plan routing using Gemini Flash LLM
 */
export async function planWithLLM(prompt: string): Promise<PlanningResult> {
  const systemPrompt = `You are a routing agent for Hivemind Protocol, an AI agent orchestration system.

Available specialists:
- magos: Market analysis, price predictions, technical analysis, risk assessment
- aura: Social sentiment analysis, trending topics, influencer tracking, FOMO/FUD detection
- bankr: Wallet operations (transfers, swaps, balances), Solana transactions, DeFi operations
- scribe: General assistant, summarization, explanations, documentation
- seeker: Web research, news lookup, search queries, current events

Your task: Analyze the user's prompt and select the BEST specialist to handle it.

Return ONLY a JSON object in this exact format:
{
  "specialist": "name",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this specialist was chosen"
}

Rules:
- confidence should be 0.0 to 1.0
- If multiple specialists could help, choose the PRIMARY one (the one that best addresses the core intent)
- For ambiguous queries, use "scribe" as fallback
- Be decisive - avoid low confidence scores unless truly uncertain`;

  try {
    // Use Gemini Flash for fast, cheap routing decisions
    const response = await callGeminiFlash(systemPrompt, prompt);
    
    // Parse JSON response
    const parsed = JSON.parse(response);
    
    // Validate specialist name
    const validSpecialists: SpecialistType[] = ['magos', 'aura', 'bankr', 'scribe', 'seeker'];
    if (!validSpecialists.includes(parsed.specialist)) {
      console.warn(`[LLM Planner] Invalid specialist "${parsed.specialist}", falling back to scribe`);
      return {
        specialist: 'scribe',
        confidence: 0.5,
        reasoning: `LLM suggested invalid specialist "${parsed.specialist}", using fallback`
      };
    }
    
    return {
      specialist: parsed.specialist,
      confidence: Math.min(1.0, Math.max(0.0, parsed.confidence)),
      reasoning: parsed.reasoning || 'No reasoning provided'
    };
  } catch (error: any) {
    console.error(`[LLM Planner] Failed to plan routing:`, error.message);
    // Fallback to scribe on error
    return {
      specialist: 'scribe',
      confidence: 0.3,
      reasoning: `LLM planning failed (${error.message}), using fallback`
    };
  }
}

/**
 * Call Gemini Flash API
 * Uses the same Gemini configuration as other specialists
 */
async function callGeminiFlash(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  
  const fetch = (await import('node-fetch')).default;
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
  
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemPrompt },
          { text: `\n\nUser query: "${userPrompt}"` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2, // Low temperature for consistent routing
      maxOutputTokens: 200,
      topP: 0.8,
    }
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${error}`);
  }
  
  const data: any = await response.json();
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No response from Gemini');
  }
  
  // Extract JSON from response (remove markdown code blocks if present)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not parse JSON from response: ${text}`);
  }
  
  return jsonMatch[0];
}

export default {
  planWithLLM
};
