import { routePrompt } from '../dispatcher';

jest.mock('../capability-matcher', () => ({
  capabilityMatcher: {
    extractIntent: jest.fn(async () => ({ category: 'unknown' })),
    matchAgents: jest.fn(async () => []),
  },
}));

jest.mock('../intent-classifier', () => ({
  classifyIntent: jest.fn(async () => null),
}));

jest.mock('../external-agents', () => ({
  getExternalAgents: jest.fn(() => []),
  isExternalAgent: jest.fn(() => false),
  callExternalAgent: jest.fn(),
  getExternalAgent: jest.fn(() => null),
}));

describe('Phase 4 routing eval set', () => {
  const evalSet: Array<{ prompt: string; expected: string; bucket: string }> = [
    { prompt: 'What is the price of SOL right now?', expected: 'magos', bucket: 'prices' },
    { prompt: 'How much is BONK today?', expected: 'magos', bucket: 'prices' },
    { prompt: 'Price prediction for WIF this week', expected: 'magos', bucket: 'prices' },
    { prompt: 'What is the sentiment around Base ecosystem?', expected: 'aura', bucket: 'sentiment' },
    { prompt: 'What tokens are people talking about?', expected: 'aura', bucket: 'sentiment' },
    { prompt: 'Find trending meme coins on X', expected: 'aura', bucket: 'sentiment' },
    { prompt: 'Is crypto Twitter bullish or bearish?', expected: 'aura', bucket: 'sentiment' },
    { prompt: 'Swap 1 SOL to USDC', expected: 'bankr', bucket: 'trade' },
    { prompt: 'Send 0.01 SOL to 11111111111111111111111111111111', expected: 'bankr', bucket: 'trade' },
    { prompt: 'Approve 100 USDC for router spending', expected: 'bankr', bucket: 'trade' },
    { prompt: 'Check my wallet balance', expected: 'bankr', bucket: 'wallet' },
    { prompt: 'Tell me about Circle CCTP latest docs', expected: 'seeker', bucket: 'research' },
    { prompt: 'Research current Base TVL trend and summarize', expected: 'multi-hop', bucket: 'multi-hop' },
    { prompt: 'Find top trending token then buy $25 worth', expected: 'multi-hop', bucket: 'multi-hop' },
    { prompt: 'Should I buy WIF right now?', expected: 'magos', bucket: 'edge phrasing' },
    { prompt: 'asdfghjkl random gibberish', expected: 'general', bucket: 'edge phrasing' },
  ];

  test('routing precision should meet phase 4 threshold', async () => {
    const results = await Promise.all(
      evalSet.map(async (item) => ({
        ...item,
        got: await routePrompt(item.prompt),
      })),
    );

    const passed = results.filter((r) => r.got === r.expected);
    const precision = passed.length / results.length;

    expect(precision).toBeGreaterThanOrEqual(0.9);

    const buckets = Array.from(new Set(results.map((r) => r.bucket)));
    for (const bucket of buckets) {
      const rows = results.filter((r) => r.bucket === bucket);
      const bucketPrecision = rows.filter((r) => r.got === r.expected).length / rows.length;
      expect(bucketPrecision).toBeGreaterThanOrEqual(0.75);
    }
  });
});
