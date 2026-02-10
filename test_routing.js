
function routeWithRegExp(prompt, hiredAgents) {
  const lower = prompt.toLowerCase();
  
  // Specific intent detection for common mis-routings
  if (lower.includes('good buy') || lower.includes('should i') || lower.includes('recommend') || /is \w+ a good/.test(lower)) {
    console.log("Matched: good buy/should i/recommend");
    if (!hiredAgents || hiredAgents.includes('magos')) return 'magos';
  }
  
  if (lower.includes('talking about') || lower.includes('mentions') || lower.includes('discussing')) {
    console.log("Matched: talking about/mentions/discussing");
    if (!hiredAgents || hiredAgents.includes('aura')) return 'aura';
  }
  
  // Price queries should go to magos (market analysis), not seeker
  const regex1 = /price|value|worth|cost.*\b(sol|eth|btc|bonk|wif|pepe|usdc|usdt)\b/i;
  const regex2 = /\b(sol|eth|btc|bonk|wif|pepe)\b.*price/i;
  
  if (regex1.test(prompt) || regex2.test(prompt)) {
    console.log("Matched: Price query special detection");
    if (regex1.test(prompt)) console.log("  Regex 1 matched");
    if (regex2.test(prompt)) console.log("  Regex 2 matched");
    const match1 = prompt.match(regex1);
    const match2 = prompt.match(regex2);
    if (match1) console.log("  Match 1:", match1[0], "Capture:", match1[1]);
    if (match2) console.log("  Match 2:", match2[0], "Capture:", match2[1]);
    if (!hiredAgents || hiredAgents.includes('magos')) return 'magos';
  }

  // Define routing rules with weights
  const rules = [
    {
      specialist: 'sentinel',
      patterns: [
        /audit|security|vulnerabilit|exploit|hack|reentrancy|overflow|access.control/,
        /smart\s*contract.*(?:check|review|scan|inspect|analyz)/,
        /contract.*(?:safe|secure|risk|danger)/,
        /0x[a-fA-F0-9]{40}/, // Contract address pattern
      ],
      weight: 1.5, // Higher weight — specific capability
    },
    {
      specialist: 'magos',
      patterns: [
        /predict|forecast|price\s+target|will\s+\w+\s+(go|reach|hit)/,
        /risk|danger|safe|analysis|analyze|technical/,
        /support|resistance|trend|pattern|chart/,
      ],
      weight: 1,
    },
    {
      specialist: 'aura',
      patterns: [
        /sentiment|vibe|mood|feeling|social/,
        /trending|hot|popular|alpha|gem/,
        /influencer|kol|whale\s+watch|twitter|x\s+/,
        /fomo|fud|hype|buzz/,
      ],
      weight: 1,
    },
    {
      specialist: 'bankr',
      patterns: [
        /swap|trade|buy|sell|exchange/,
        /transfer|send|withdraw|deposit/,
        /\bbalance\b|my wallet|holdings|portfolio/,
        /dca|dollar\s+cost|recurring|auto-buy/,
        /solana|sol price/,
      ],
      weight: 1,
    },
    {
      specialist: 'seeker',
      patterns: [
        /search|find|lookup|what is|who is|where is|news about|latest on/,
        /research|google|brave|internet|web|look up/,
        /news|happened|today|recent|current events/,
        /what happened|tell me about/,
      ],
      weight: 1.2,
    },
    {
      specialist: 'scribe',
      patterns: [
        /summarize|explain|write|draft|document/,
        /help|question|how to|what can you/,
      ],
      weight: 0.5,
    },
  ];
  
  // Score each specialist (only those in hiredAgents if provided)
  const scores = {
    magos: 0,
    aura: 0,
    bankr: 0,
    scribe: 0,
    seeker: 0,
    sentinel: 0,
    general: 0,
    'multi-hop': 0,
  };
  
  for (const rule of rules) {
    if (hiredAgents && !hiredAgents.includes(rule.specialist)) continue;
    
    for (const pattern of rule.patterns) {
      if (pattern.test(lower)) {
        console.log(`  Rule ${rule.specialist} matched pattern ${pattern}`);
        scores[rule.specialist] += rule.weight;
      }
    }
  }
  
  console.log("Scores:", scores);
  
  // Find highest scoring specialist
  let bestSpecialist = 'general';
  let bestScore = 0;
  
  for (const [specialist, score] of Object.entries(scores)) {
    if (hiredAgents && !hiredAgents.includes(specialist) && specialist !== 'general') continue;
    
    if (score > bestScore) {
      bestScore = score;
      bestSpecialist = specialist;
    }
  }
  
  return bestSpecialist;
}

async function test() {
  const prompts = [
    "Compare Bitcoin price trends with current political betting odds",
    "Audit the security of a Solana smart contract Bq48PaxtoWv62QHeX3WYfmHHw9E7hJp38sx5t6tugDyd and estimate its market value",
    "What are people saying about AI agents on social media and how does that affect crypto prices?"
  ];

  for (const prompt of prompts) {
    console.log(`\nPrompt: "${prompt}"`);
    const specialist = routeWithRegExp(prompt);
    console.log(`Routed to: ${specialist}`);
  }
}

test();
