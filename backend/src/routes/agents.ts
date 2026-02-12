import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import config from '../config';
import { registerAgent, getExternalAgents, getExternalAgent, healthCheckAgent, removeAgent } from '../external-agents';
import { RegisterRequest } from '../types';

const router = Router();

// Load registrations file path
const REGISTRATIONS_PATH = path.join(__dirname, '../../../agents/registrations.json');

/**
 * ERC-8004 Agent Registration Files
 * GET /api/agents - List all registered agents
 */
router.get('/agents', (req: Request, res: Response) => {
  try {
    const registrations = JSON.parse(fs.readFileSync(REGISTRATIONS_PATH, 'utf8'));
    res.json({
      agents: registrations.map((r: any, i: number) => ({
        agentId: i + 1,
        name: r.name,
        description: r.description,
        active: r.active,
        x402Support: r.x402Support,
        supportedTrust: r.supportedTrust,
      })),
      identityRegistry: config.erc8004.identityRegistry || 'pending-deployment',
      reputationRegistry: config.erc8004.reputationRegistry || 'pending-deployment',
      chain: 'Base Sepolia (EIP-155:84532)',
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/agents/:id/registration - Get agent registration file
 */
router.get('/agents/:id/registration', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id) - 1;
    const registrations = JSON.parse(fs.readFileSync(REGISTRATIONS_PATH, 'utf8'));
    if (id < 0 || id >= registrations.length) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(registrations[id]);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/agents/register - Register an external agent on the marketplace
 */
router.post('/agents/register', async (req: Request, res: Response) => {
  try {
    const { name, description, endpoint, wallet, capabilities, pricing, chain } = req.body as RegisterRequest;

    if (!name || !description || !endpoint || !wallet || !capabilities?.length) {
      return res.status(400).json({
        error: 'Missing required fields: name, description, endpoint, wallet, capabilities[]',
      });
    }

    // Sanitize text inputs (strip HTML tags to prevent XSS)
    const sanitize = (s: string) => s.replace(/<[^>]*>/g, '').trim();
    const cleanName = sanitize(name);
    const cleanDescription = sanitize(description);

    if (!cleanName || cleanName.length > 100) {
      return res.status(400).json({ error: 'Invalid name (max 100 chars, no HTML)' });
    }
    if (cleanDescription.length > 1000) {
      return res.status(400).json({ error: 'Description too long (max 1000 chars)' });
    }

    // Validate endpoint URL
    try {
      new URL(endpoint);
    } catch {
      return res.status(400).json({ error: 'Invalid endpoint URL' });
    }

    // Health check the agent before registering
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let healthOk = false;
    let agentInfo: any = null;

    try {
      const healthRes = await fetch(`${endpoint.replace(/\/$/, '')}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      healthOk = healthRes.ok;
      if (healthOk) agentInfo = await healthRes.json();
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn(`[Register] Health check failed for ${endpoint}:`, err.message);
    }

    const agent = registerAgent({ name: cleanName, description: cleanDescription, endpoint, wallet, capabilities, pricing, chain });

    // Also try to get /info for richer metadata
    try {
      const infoRes = await fetch(`${agent.endpoint}/info`, { signal: AbortSignal.timeout(5000) });
      if (infoRes.ok) {
        const infoData = await infoRes.json() as any;
        agentInfo = { ...agentInfo, ...infoData };
      }
    } catch {}

    res.status(201).json({
      success: true,
      agent: {
        ...agent,
        healthCheck: healthOk ? 'passed' : 'failed (registered anyway)',
        agentInfo,
      },
      message: `Agent '${agent.name}' registered successfully. It will now appear in the marketplace.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/agents/external - List all registered external agents
 */
router.get('/agents/external', (req: Request, res: Response) => {
  const agents = getExternalAgents();
  res.json({ agents, count: agents.length });
});

/**
 * GET /api/agents/external/:id - Get details about a specific external agent
 */
router.get('/agents/external/:id', (req: Request, res: Response) => {
  const agent = getExternalAgent(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'External agent not found' });
  }
  res.json(agent);
});

/**
 * POST /api/agents/external/:id/health - Health check an external agent
 */
router.post('/agents/external/:id/health', async (req: Request, res: Response) => {
  const healthy = await healthCheckAgent(req.params.id);
  const agent = getExternalAgent(req.params.id);
  res.json({
    id: req.params.id,
    healthy,
    lastCheck: agent?.lastHealthCheck,
  });
});

/**
 * DELETE /api/agents/external/:id - Remove an external agent
 */
router.delete('/agents/external/:id', (req: Request, res: Response) => {
  const removed = removeAgent(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'External agent not found' });
  }
  res.json({ success: true, message: `Agent '${req.params.id}' removed.` });
});

export default router;
