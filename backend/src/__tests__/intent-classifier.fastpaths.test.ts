import { classifyIntent } from '../intent-classifier';

jest.mock('../llm-client', () => ({
  MODELS: { fast: 'fast' },
  chatJSON: jest.fn(),
}));

describe('Intent classifier fast-paths', () => {
  test('routes trending meme coin query to aura sentiment specialist', async () => {
    const result = await classifyIntent('Find trending meme coins on Base');
    expect(result).not.toBeNull();
    expect(result?.specialist).toBe('aura');
    expect(result?.category).toBe('sentiment');
  });

  test('routes base ecosystem sentiment query to aura sentiment specialist', async () => {
    const result = await classifyIntent("What's the sentiment around Base ecosystem");
    expect(result).not.toBeNull();
    expect(result?.specialist).toBe('aura');
    expect(result?.category).toBe('sentiment');
  });
});
