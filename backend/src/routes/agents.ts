import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { registerAgent, getExternalAgents, getExternalAgent, healthCheckAgent, removeAgent } from '../external-agents';
import { RegisterRequest } from '../types';
import { validateExternalEndpointUrl, revalidateEndpointResolution } from '../utils/ssrf';
import { getRegistrations } from '../utils/registrations-cache';
import { normalizeClientNetworkMode } from '../utils/client-network';
import { getNetworkConfig, getNetworkModeFromChain } from '../utils/network-config';

const router = Router();

router.get('/agents', async (req: Request, res: Response) => {
  try {
    const mode = normalizeClientNetworkMode(req.query.network || req.query.networkMode);
    const network = getNetworkConfig(mode);
    const registrations = await getRegistrations();
    const filtered = registrations.filter((registration: any) => {
      if (!registration?.chain && !registration?.networkMode) return true;
      return getNetworkModeFromChain(registration.chain || registration.networkMode) === mode;
    });
    res.json({
      agents: filtered.map((r: any, i: number) => ({
        agentId: i + 1,
        name: r.name,
        description: r.description,
        active: r.active,
        x402Support: r.x402Support,
        supportedTrust: r.supportedTrust,
      })),
      identityRegistry: network.identityRegistry || 'pending-deployment',
      reputationRegistry: network.reputationRegistry || 'pending-deployment',
      chain: network.displayName,
      chainId: network.chainId,
      networkMode: mode,
    });
  } catch (_error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/agents/:id/registration', async (req: Request, res: Response) => {
  try {
    const mode = normalizeClientNetworkMode(req.query.network || req.query.networkMode);
    const id = parseInt(req.params.id) - 1;
    const registrations = await getRegistrations();
    const filtered = registrations.filter((registration: any) => {
      if (!registration?.chain && !registration?.networkMode) return true;
      return getNetworkModeFromChain(registration.chain || registration.networkMode) === mode;
    });
    if (id < 0 || id >= filtered.length) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(filtered[id]);
  } catch (_error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/agents/register', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, endpoint, wallet, capabilities, pricing, chain } = req.body as RegisterRequest;

    if (!name || !description || !endpoint || !wallet || !capabilities?.length) {
      return res.status(400).json({
        error: 'Missing required fields: name, description, endpoint, wallet, capabilities[]',
      });
    }

    const sanitize = (s: string) => s.replace(/<[^>]*>/g, '').trim();
    const cleanName = sanitize(name);
    const cleanDescription = sanitize(description);

    if (!cleanName || cleanName.length > 100) {
      return res.status(400).json({ error: 'Invalid name (max 100 chars, no HTML)' });
    }
    if (cleanDescription.length > 1000) {
      return res.status(400).json({ error: 'Description too long (max 1000 chars)' });
    }

    let endpointUrl: URL;
    let initialIps: string[];
    try {
      const validated = await validateExternalEndpointUrl(endpoint);
      endpointUrl = validated.url;
      initialIps = validated.resolvedIps;
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Invalid endpoint URL' });
    }

    let healthOk = false;
    let agentInfo: any = null;

    try {
      await revalidateEndpointResolution(endpointUrl, initialIps);
      const healthRes = await fetch(`${endpointUrl.toString().replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(8000),
      });
      healthOk = healthRes.ok;
      if (healthOk) agentInfo = await healthRes.json();
    } catch (err: any) {
      console.warn(`[Register] Health check failed for ${endpoint}:`, err.message);
    }

    const normalizedEndpoint = endpointUrl.toString().replace(/\/$/, '');
    const agent = registerAgent({ name: cleanName, description: cleanDescription, endpoint: normalizedEndpoint, wallet, capabilities, pricing, chain });

    try {
      await revalidateEndpointResolution(endpointUrl, initialIps);
      const infoRes = await fetch(`${normalizedEndpoint}/info`, { signal: AbortSignal.timeout(5000) });
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
  } catch (_error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/agents/external', (req: Request, res: Response) => {
  const mode = normalizeClientNetworkMode(req.query.network || req.query.networkMode);
  const agents = getExternalAgents(mode);
  res.json({ agents, count: agents.length, networkMode: mode });
});

router.get('/agents/external/:id', (req: Request, res: Response) => {
  const mode = normalizeClientNetworkMode(req.query.network || req.query.networkMode);
  const agent = getExternalAgent(req.params.id, mode);
  if (!agent) {
    return res.status(404).json({ error: 'External agent not found' });
  }
  res.json(agent);
});

router.post('/agents/external/:id/health', authMiddleware, async (req: Request, res: Response) => {
  const mode = normalizeClientNetworkMode(req.query.network || req.query.networkMode || req.body?.networkMode);
  const healthy = await healthCheckAgent(req.params.id, mode);
  const agent = getExternalAgent(req.params.id, mode);
  res.json({
    id: req.params.id,
    healthy,
    lastCheck: agent?.lastHealthCheck,
  });
});

router.delete('/agents/external/:id', authMiddleware, (req: Request, res: Response) => {
  const mode = normalizeClientNetworkMode(req.query.network || req.query.networkMode || req.body?.networkMode);
  const removed = removeAgent(req.params.id, mode);
  if (!removed) {
    return res.status(404).json({ error: 'External agent not found' });
  }
  res.json({ success: true, message: `Agent '${req.params.id}' removed.` });
});

export default router;
