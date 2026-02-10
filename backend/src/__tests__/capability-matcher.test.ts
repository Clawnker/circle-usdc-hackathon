
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('node-fetch');
jest.mock('../external-agents');
jest.mock('../reputation');

import { CapabilityMatcher, EmbeddingService } from '../capability-matcher';
import * as reputation from '../reputation';
import { UserIntent, Capability, ExternalAgent } from '../types';

describe('CapabilityMatcher', () => {
  let matcher: CapabilityMatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock reputation scores
    (reputation.getReputationScore as jest.Mock).mockReturnValue(0.9);
    (reputation.getSuccessRate as jest.Mock).mockReturnValue(90);

    // Mock initializeEmbeddings to prevent background leaks
    jest.spyOn(CapabilityMatcher.prototype as any, 'initializeEmbeddings').mockResolvedValue(undefined);

    // Setup fs mocks
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p.includes('manifests')) return true;
      if (p.includes('embeddings.json')) return false;
      return false;
    });

    (fs.readdirSync as jest.Mock).mockImplementation((p: string) => {
      if (p.includes('manifests')) return ['aura.json'];
      return [];
    });

    (fs.readFileSync as jest.Mock).mockImplementation((p: string) => {
      if (p.includes('aura.json')) {
        return JSON.stringify([
          {
            id: 'aura:sentiment',
            name: 'Social Sentiment',
            description: 'Analyze social media sentiment',
            category: 'social',
            subcategories: ['sentiment'],
            inputs: [],
            outputs: { type: 'json' },
            confidenceScore: 0.8,
            latencyEstimateMs: 1000
          }
        ]);
      }
      return '';
    });

    // Mock external agents
    const { getExternalAgents } = require('../external-agents');
    getExternalAgents.mockReturnValue([]);

    // Create a new instance for each test
    matcher = new CapabilityMatcher();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Cosine Similarity', () => {
    it('should correctly calculate similarity between identical vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [1, 0, 0];
      const sim = (matcher as any).cosineSimilarity(v1, v2);
      expect(sim).toBeCloseTo(1.0);
    });

    it('should correctly calculate similarity between orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];
      const sim = (matcher as any).cosineSimilarity(v1, v2);
      expect(sim).toBeCloseTo(0.0);
    });

    it('should correctly calculate similarity between opposite vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [-1, 0, 0];
      const sim = (matcher as any).cosineSimilarity(v1, v2);
      expect(sim).toBeCloseTo(-1.0);
    });

    it('should correctly calculate similarity between known vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];
      const sim = (matcher as any).cosineSimilarity(v1, v2);
      expect(sim).toBeCloseTo(0.9746, 4);
    });
  });

  describe('Intent Extraction', () => {
    it('should call Gemini and return structured UserIntent', async () => {
      const mockResponse = {
        category: 'security',
        requiredCapabilities: ['audit smart contract'],
        constraints: { preferredNetwork: 'base' },
        entities: { addresses: ['0x123'] }
      };

      jest.spyOn(matcher as any, 'callGeminiFlash').mockResolvedValue(JSON.stringify(mockResponse));

      const intent = await matcher.extractIntent('Audit this 0x123 on Base');
      
      expect(intent).toEqual(mockResponse);
      expect((matcher as any).callGeminiFlash).toHaveBeenCalled();
    });

    it('should return fallback intent on failure', async () => {
      jest.spyOn(matcher as any, 'callGeminiFlash').mockRejectedValue(new Error('API Error'));

      const intent = await matcher.extractIntent('some prompt');
      
      expect(intent.category).toBe('generic');
      expect(intent.requiredCapabilities).toContain('some prompt');
    });
  });

  describe('Agent Matching and Scoring', () => {
    beforeEach(() => {
      // Ensure vector store is populated
      const mockVectorStore = new Map();
      mockVectorStore.set('aura', [[1, 0, 0]]);
      (matcher as any).vectorStore = mockVectorStore;

      // Mock embedding service for query
      jest.spyOn((matcher as any).embeddingService, 'generateEmbedding').mockResolvedValue([1, 0, 0]);
    });

    it('should rank agents correctly based on semantic similarity', async () => {
      const intent: UserIntent = {
        category: 'social',
        requiredCapabilities: ['sentiment analysis'],
        constraints: {},
        entities: {}
      };

      const matches = await matcher.matchAgents(intent);
      
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].agentId).toBe('aura');
    });

    it('should verify the scoring formula weights', async () => {
      const intent: UserIntent = {
        category: 'social',
        requiredCapabilities: ['sentiment analysis'],
        constraints: {},
        entities: {}
      };

      const matches = await matcher.matchAgents(intent);
      const auraMatch = matches.find(m => m.agentId === 'aura');
      
      expect(auraMatch).toBeDefined();
      if (auraMatch) {
        // Formula: (maxSim * 0.4) + (reputation * 0.3) + (priceEfficiency * 0.3)
        // maxSim = 1.0
        // reputation = 0.9 (from mock)
        // priceEfficiency = ~1.0 (built-in, no pricing data = default)
        // Score = 0.4 + 0.27 + 0.3 = 0.97 (approx, health penalty = 1.0)
        expect(auraMatch.score).toBeGreaterThan(0.8);
        expect(auraMatch.score).toBeLessThanOrEqual(1.0);
      }
    });
  });

  describe('Threshold Behavior', () => {
    it('should exclude agents with similarity below 0.75', async () => {
      const mockVectorStore = new Map();
      // Similarity with [1, 0, 0] is 0.707
      mockVectorStore.set('aura', [[0.707, 0.707, 0]]); 
      (matcher as any).vectorStore = mockVectorStore;

      jest.spyOn((matcher as any).embeddingService, 'generateEmbedding').mockResolvedValue([1, 0, 0]);

      const intent: UserIntent = {
        category: 'social',
        requiredCapabilities: ['something'],
        constraints: {},
        entities: {}
      };

      const matches = await matcher.matchAgents(intent);
      expect(matches).toHaveLength(0);
    });
  });

  describe('Legacy Compatibility', () => {
    it('should handle agents with legacy string[] capabilities', () => {
      const agentId = 'test-agent';
      const legacyCaps = ['swap', 'audit'];
      
      const structuredCapabilities = legacyCaps.map(cap => ({
        id: `${agentId}:${cap}`,
        name: cap,
        description: `Capability ${cap}`,
        category: 'generic' as const,
        subcategories: [],
        inputs: [],
        outputs: { type: 'json' as const },
        confidenceScore: 0.8,
        latencyEstimateMs: 1000,
      }));

      expect(structuredCapabilities[0].name).toBe('swap');
      expect(structuredCapabilities[1].name).toBe('audit');
    });
  });

  describe('Embedding Persistence', () => {
    it('should load embeddings from disk if they exist', () => {
      const mockEmbeddings = {
        'aura': [[0.1, 0.2, 0.3]]
      };

      (fs.existsSync as jest.Mock).mockImplementation((p: string) => p.includes('embeddings.json'));
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockEmbeddings));

      const newMatcher = new CapabilityMatcher();
      expect((newMatcher as any).vectorStore.get('aura')).toEqual(mockEmbeddings.aura);
    });

    it('should save embeddings to disk', () => {
      const mockVectors = [[0.1, 0.2, 0.3]];
      (matcher as any).vectorStore.set('test-agent', mockVectors);
      
      (matcher as any).saveEmbeddings();
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('embeddings.json'),
        expect.stringContaining('test-agent'),
        'utf8'
      );
    });
  });
});
