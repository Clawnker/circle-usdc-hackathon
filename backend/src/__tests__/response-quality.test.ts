import { extractResponseContent } from '../dispatcher';

describe('Phase 4 response readability', () => {
  test('formats nested response objects without raw JSON dump', () => {
    const text = extractResponseContent({
      success: true,
      data: {
        details: {
          response: {
            route: 'Jupiter',
            amountIn: '1 SOL',
            amountOut: '120 USDC',
            warnings: ['price impact 0.7%', 'network congestion'],
          },
        },
      },
      timestamp: new Date(),
      executionTimeMs: 42,
    } as any);

    expect(text).toContain('• route: Jupiter');
    expect(text).toContain('• warnings:');
    expect(text).not.toContain('{"route"');
  });

  test('keeps concise human fallback on unknown payloads', () => {
    const text = extractResponseContent({
      success: true,
      data: { alpha: 'yes', beta: 2 },
      timestamp: new Date(),
      executionTimeMs: 15,
    } as any);

    expect(text).toContain('• alpha: yes');
    expect(text).toContain('• beta: 2');
  });
});
