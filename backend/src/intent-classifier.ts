import { chatJSON, MODELS } from './llm-client';
import { SpecialistType } from './types';

// In-memory cache for intent classification
const intentCache = new Map<string, { category: string; confidence: number; specialist: SpecialistType; entities: string[] }>();
const MAX_CACHE_SIZE = 200;

function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().trim();
}

// Regex patterns for fast-path classification
const priceRegex = /^(what is the price of|price of|how much is)\s(.+)/i;
const buyRegex = /^(buy|purchase)\s(.+)/i;
const auditRegex = /^(audit|check security of)\s(0x[a-fA-F0-9]{40})/i;
const sentimentRegex = /^(sentiment of|how is the sentiment on)\s(.+)/i;
const researchRegex = /^(research|find information on|tell me about)\s(.+)/i;
const tradeRegex = /^(swap|trade|exchange)\s(.+)/i;
const multiHopRegex = /^(plan a multi-hop trade for|multi-hop trade)\s(.+)/i;
const securityScanRegex = /^(scan|check|audit) (contract|address|token) (.*)/i;


export async function classifyIntent(prompt: string): Promise<{ category: string; confidence: number; specialist: SpecialistType; entities: string[] } | null> {
  const normalizedPrompt = normalizePrompt(prompt);

  // 1. Cache check
  if (intentCache.has(normalizedPrompt)) {
    return intentCache.get(normalizedPrompt)!;
  }

  // Map categories to SpecialistType
  const specialistMap: Record<string, SpecialistType> = {
    'price': 'magos',
    'sentiment': 'aura',
    'trade': 'bankr',
    'research': 'seeker',
    'analysis': 'magos',
    'security': 'sentinel',
    'multi-hop': 'multi-hop',
    'general': 'general',
  };

  const mapAndReturn = (category: string, entity: string, confidence: number = 1.0) => {
    const specialist = specialistMap[category] || 'general';
    return { category, confidence, specialist, entities: entity ? [entity] : [] };
  };


  // 2. Fast-path regexes
  let fastPathResult: { category: string; confidence: number; specialist: SpecialistType; entities: string[] } | null = null;
  let match;

  if ((match = normalizedPrompt.match(priceRegex))) {
    fastPathResult = mapAndReturn('price', match[2]);
  } else if ((match = normalizedPrompt.match(buyRegex))) {
    fastPathResult = mapAndReturn('trade', match[2]);
  } else if ((match = normalizedPrompt.match(tradeRegex))) {
    fastPathResult = mapAndReturn('trade', match[2]);
  } else if ((match = normalizedPrompt.match(auditRegex))) {
    fastPathResult = mapAndReturn('security', match[2]);
  } else if ((match = normalizedPrompt.match(sentimentRegex))) {
    fastPathResult = mapAndReturn('sentiment', match[2]);
  } else if ((match = normalizedPrompt.match(researchRegex))) {
    fastPathResult = mapAndReturn('research', match[2]);
  } else if ((match = normalizedPrompt.match(multiHopRegex))) {
    fastPathResult = mapAndReturn('multi-hop', match[2]);
  } else if ((match = normalizedPrompt.match(securityScanRegex))) {
    fastPathResult = mapAndReturn('security', match[3]);
  }

  if (fastPathResult) {
    // Add to cache
    if (intentCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = intentCache.keys().next().value;
      intentCache.delete(oldestKey);
    }
    intentCache.set(normalizedPrompt, fastPathResult);
    return fastPathResult;
  }

  // 3. LLM call for classification
  const systemPrompt = `You are an intent classifier for a decentralized agent network.
Classify the user's prompt into one of the following categories:
- price: User is asking for the current or historical price of a digital asset.
- sentiment: User is asking for sentiment analysis on a topic or digital asset.
- trade: User wants to perform a trade (swap, buy, sell) of digital assets.
- research: User is requesting general information or research on a topic, project, or asset.
- analysis: User is requesting an in-depth analysis or report on a digital asset, protocol, or market trend.
- security: User is requesting a security audit, vulnerability check, or risk assessment for a smart contract or address.
- multi-hop: User is asking for a complex trade involving multiple steps or protocols.
- general: The intent does not fit clearly into any other category, or is a general question.

Extract any relevant entities (e.g., token names, addresses, protocols) from the prompt.
Assign a confidence score (0.0 to 1.0) for your classification.
Map the category to a specialist: 'magos' for price/analysis, 'aura' for sentiment, 'bankr' for trade, 'seeker' for research, 'sentinel' for security, 'multi-hop' for multi-hop, 'general' for general.

Respond with a JSON object in the format:
{
  "category": "string",
  "confidence": "number",
  "specialist": "SpecialistType",
  "entities": ["string"]
}
`;

  try {
    const { data } = await chatJSON<{
      category: string;
      confidence: number;
      specialist: SpecialistType;
      entities: string[];
    }>(systemPrompt, prompt, {
      model: MODELS.fast,
      temperature: 0.1,
      caller: 'intent-classifier',
    });

    // Ensure specialist is valid
    const validSpecialists = Object.values(specialistMap) as string[];
    if (!validSpecialists.includes(data.specialist)) {
      console.warn(`[Intent Classifier] LLM returned invalid specialist: ${data.specialist}. Defaulting to 'general'.`);
      data.specialist = 'general';
    }

    // 4. Confidence check
    if (data.confidence < 0.7) {
      console.log(`[Intent Classifier] Low confidence (${(data.confidence * 100).toFixed(0)}%) for prompt: "${prompt}". Falling through.`);
      return null;
    }

    // 5. Cache set
    if (intentCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = intentCache.keys().next().value;
      intentCache.delete(oldestKey);
    }
    intentCache.set(normalizedPrompt, data);
    return data;
  } catch (e: any) {
    console.error(`[Intent Classifier] LLM classification failed for prompt "${prompt}": ${e.message}`);
    return null; // Fallback to capability matcher
  }
}
