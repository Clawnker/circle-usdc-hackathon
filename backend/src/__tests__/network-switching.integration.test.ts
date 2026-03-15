import * as fs from 'fs';
import * as path from 'path';

jest.mock('../middleware/erc8128-auth', () => ({
  hasErc8128Headers: () => false,
  verifyErc8128Request: jest.fn(),
}));

import dispatchRoutes from '../routes/dispatch';
import paymentRoutes from '../routes/payments';
import agentRoutes from '../routes/agents';
import { registerAgent, removeAgent } from '../external-agents';
import { callSpecialist } from '../dispatcher';

const REGISTRATIONS_PATH = path.join(__dirname, '../../../agents/registrations.json');
const EXTERNAL_AGENTS_PATH = path.join(__dirname, '../../data/external-agents.json');
const SIMULATED_BALANCES_PATH = path.join(__dirname, '../../data/simulated-balances.json');

describe('environment switching integration', () => {
  let registrationsBackup = '';
  let externalAgentsBackup: string | null = null;
  let simulatedBalancesBackup: string | null = null;

  beforeAll(async () => {
    process.env.ENABLE_MAINNET_DISPATCH = 'true';

    registrationsBackup = fs.readFileSync(REGISTRATIONS_PATH, 'utf8');
    externalAgentsBackup = fs.existsSync(EXTERNAL_AGENTS_PATH) ? fs.readFileSync(EXTERNAL_AGENTS_PATH, 'utf8') : null;
    simulatedBalancesBackup = fs.existsSync(SIMULATED_BALANCES_PATH) ? fs.readFileSync(SIMULATED_BALANCES_PATH, 'utf8') : null;
  });

  afterAll(async () => {
    removeAgent('network-switch-auditor', 'testnet');
    removeAgent('network-switch-auditor', 'mainnet');

    fs.writeFileSync(REGISTRATIONS_PATH, registrationsBackup, 'utf8');

    if (externalAgentsBackup === null) {
      fs.rmSync(EXTERNAL_AGENTS_PATH, { force: true });
    } else {
      fs.writeFileSync(EXTERNAL_AGENTS_PATH, externalAgentsBackup, 'utf8');
    }

    if (simulatedBalancesBackup === null) {
      fs.rmSync(SIMULATED_BALANCES_PATH, { force: true });
    } else {
      fs.writeFileSync(SIMULATED_BALANCES_PATH, simulatedBalancesBackup, 'utf8');
    }
  });

  function getRouteHandler(router: any, method: 'get' | 'post', routePath: string) {
    const layer = router.stack.find((entry: any) => entry.route?.path === routePath && entry.route.methods?.[method]);
    if (!layer) {
      throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
    }
    return layer.route.stack[layer.route.stack.length - 1].handle;
  }

  async function invokeRoute(
    router: any,
    method: 'get' | 'post',
    routePath: string,
    options: { body?: any; query?: any; params?: any; headers?: Record<string, string> } = {}
  ) {
    const handler = getRouteHandler(router, method, routePath);
    const req: any = {
      body: options.body || {},
      query: options.query || {},
      params: options.params || {},
      headers: options.headers || {},
      header(name: string) {
        return this.headers[name] || this.headers[name.toLowerCase()];
      },
      get(name: string) {
        return this.header(name);
      },
      path: routePath,
      method: method.toUpperCase(),
      originalUrl: routePath,
    };

    return await new Promise<{ status: number; json: any }>((resolve, reject) => {
      const res: any = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          resolve({ status: this.statusCode, json: payload });
          return this;
        },
      };

      Promise.resolve(handler(req, res, reject)).catch(reject);
    });
  }

  it('switches route preview and wallet metadata between testnet and mainnet', async () => {
    const [testnetPreview, mainnetPreview] = await Promise.all([
      invokeRoute(dispatchRoutes, 'post', '/route-preview', { body: { prompt: 'check my wallet balance', networkMode: 'testnet' } }),
      invokeRoute(dispatchRoutes, 'post', '/route-preview', { body: { prompt: 'check my wallet balance', networkMode: 'mainnet' } }),
    ]);

    expect(testnetPreview.status).toBe(200);
    expect(mainnetPreview.status).toBe(200);
    expect(testnetPreview.json.networkMode).toBe('testnet');
    expect(mainnetPreview.json.networkMode).toBe('mainnet');
    expect(testnetPreview.json.network).toBe('base-sepolia');
    expect(mainnetPreview.json.network).toBe('base-mainnet');
    expect(testnetPreview.json.chainId).toBe(84532);
    expect(mainnetPreview.json.chainId).toBe(8453);
    expect(testnetPreview.json.usdcAddress).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
    expect(mainnetPreview.json.usdcAddress).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

    const [testnetBalances, mainnetBalances] = await Promise.all([
      invokeRoute(paymentRoutes, 'get', '/wallet/balances', { query: { network: 'testnet' } }),
      invokeRoute(paymentRoutes, 'get', '/wallet/balances', { query: { network: 'mainnet' } }),
    ]);

    expect(testnetBalances.status).toBe(200);
    expect(mainnetBalances.status).toBe(200);
    expect(testnetBalances.json.chain).toBe('base-sepolia');
    expect(mainnetBalances.json.chain).toBe('base-mainnet');
    expect(testnetBalances.json.chainId).toBe(84532);
    expect(mainnetBalances.json.chainId).toBe(8453);
    expect(testnetBalances.json.usdcAddress).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
    expect(mainnetBalances.json.usdcAddress).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('keeps external agents isolated per network when the same agent name exists on both chains', async () => {
    registerAgent({
      name: 'Network Switch Auditor',
      description: 'Security auditor on testnet',
      endpoint: 'https://testnet.example.com',
      wallet: '0x1111111111111111111111111111111111111111',
      capabilities: ['security-audit'],
      pricing: { generic: 0.25 },
      chain: 'eip155:84532',
    });

    registerAgent({
      name: 'Network Switch Auditor',
      description: 'Security auditor on mainnet',
      endpoint: 'https://mainnet.example.com',
      wallet: '0x2222222222222222222222222222222222222222',
      capabilities: ['security-audit'],
      pricing: { generic: 0.95 },
      chain: 'eip155:8453',
    });

    const [testnetAgents, mainnetAgents, testnetRegistry, mainnetRegistry] = await Promise.all([
      invokeRoute(agentRoutes, 'get', '/agents/external', { query: { network: 'testnet' } }),
      invokeRoute(agentRoutes, 'get', '/agents/external', { query: { network: 'mainnet' } }),
      invokeRoute(agentRoutes, 'get', '/agents', { query: { network: 'testnet' } }),
      invokeRoute(agentRoutes, 'get', '/agents', { query: { network: 'mainnet' } }),
    ]);

    expect(testnetAgents.status).toBe(200);
    expect(mainnetAgents.status).toBe(200);
    expect(testnetAgents.json.count).toBeGreaterThanOrEqual(1);
    expect(mainnetAgents.json.count).toBeGreaterThanOrEqual(1);

    const testnetAgent = testnetAgents.json.agents.find((agent: any) => agent.name === 'Network Switch Auditor');
    const mainnetAgent = mainnetAgents.json.agents.find((agent: any) => agent.name === 'Network Switch Auditor');

    expect(testnetAgent).toBeTruthy();
    expect(mainnetAgent).toBeTruthy();
    expect(testnetAgent.endpoint).toBe('https://testnet.example.com');
    expect(mainnetAgent.endpoint).toBe('https://mainnet.example.com');
    expect(testnetAgent.wallet).toBe('0x1111111111111111111111111111111111111111');
    expect(mainnetAgent.wallet).toBe('0x2222222222222222222222222222222222222222');
    expect(testnetAgent.chain).toBe('base-sepolia');
    expect(mainnetAgent.chain).toBe('base-mainnet');

    expect(testnetRegistry.json.networkMode).toBe('testnet');
    expect(mainnetRegistry.json.networkMode).toBe('mainnet');
    expect(testnetRegistry.json.chainId).toBe(84532);
    expect(mainnetRegistry.json.chainId).toBe(8453);
  });

  it('switches bankr wallet-action payloads to the active base network', async () => {
    fs.writeFileSync(
      SIMULATED_BALANCES_PATH,
      JSON.stringify({
        lastRealBalanceCheck: Date.now(),
        realSOL: 10,
        balances: { SOL: 10, USDC: 250 },
        transactions: [],
      }, null, 2),
      'utf8'
    );

    const prompt = 'send 5 usdc to 0x1234567890123456789012345678901234567890';
    const [testnetResult, mainnetResult] = await Promise.all([
      callSpecialist('bankr', prompt, { metadata: { networkMode: 'testnet' } }),
      callSpecialist('bankr', prompt, { metadata: { networkMode: 'mainnet' } }),
    ]);

    expect(testnetResult.success).toBe(true);
    expect(mainnetResult.success).toBe(true);
    expect(testnetResult.data.details.network).toBe('base-sepolia');
    expect(mainnetResult.data.details.network).toBe('base-mainnet');
    expect(testnetResult.data.details.chainId).toBe(84532);
    expect(mainnetResult.data.details.chainId).toBe(8453);
    expect(testnetResult.data.details.usdcContract).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
    expect(mainnetResult.data.details.usdcContract).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(String(testnetResult.data.summary)).toContain('Base Sepolia');
    expect(String(mainnetResult.data.summary)).toContain('Base Mainnet');
  });
});
