import fs from 'fs';
import path from 'path';
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

type EvalRow = {
  prompt: string;
  expected: string;
  bucket: string;
};

describe('Phase 4 routing eval set', () => {
  const evalPath = path.resolve(__dirname, '../../../docs/phase4-query-eval-set.json');
  const evalSet = JSON.parse(fs.readFileSync(evalPath, 'utf8')) as EvalRow[];

  test('dataset should include at least 40 prompts and readability coverage', () => {
    expect(evalSet.length).toBeGreaterThanOrEqual(40);

    const readability = evalSet.filter((r) => r.bucket === 'readability');
    expect(readability.length).toBeGreaterThanOrEqual(5);
    expect(readability.every((r) => r.expected === 'scribe')).toBe(true);
  });

  test('routing precision should meet phase 4 threshold by bucket', async () => {
    const results = await Promise.all(
      evalSet.map(async (item) => ({
        ...item,
        got: await routePrompt(item.prompt),
      })),
    );

    const passed = results.filter((r) => r.got === r.expected);
    const precision = passed.length / results.length;

    expect(precision).toBeGreaterThanOrEqual(0.9);

    const bucketThresholds: Record<string, number> = {
      readability: 1,
      'edge-phrasing': 0.6,
      default: 0.75,
    };

    const buckets = Array.from(new Set(results.map((r) => r.bucket)));
    for (const bucket of buckets) {
      const rows = results.filter((r) => r.bucket === bucket);
      const bucketPrecision = rows.filter((r) => r.got === r.expected).length / rows.length;
      const threshold = bucketThresholds[bucket] ?? bucketThresholds.default;
      expect(bucketPrecision).toBeGreaterThanOrEqual(threshold);
    }

    const readabilityRows = results.filter((r) => r.bucket === 'readability');
    expect(readabilityRows.every((r) => r.got === 'scribe')).toBe(true);
  });
});
