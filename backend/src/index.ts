import { createServer } from 'http';
import app from './app';
import { setupWebSocket } from './websocket';
import config from './config';
import { getTreasuryBalance } from './payments';

const server = createServer(app);
const wss = setupWebSocket(server);

const PORT = config.port;

async function start() {
  console.log('[Hivemind] Starting up...');
  
  try {
    const balances = await getTreasuryBalance();
    console.log(`[Hivemind] Treasury balance: ${balances.usdc} USDC, ${balances.eth} ETH`);
  } catch (err: any) {
    console.warn(`[Hivemind] Failed to fetch treasury balance: ${err.message}`);
  }

  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║            🐝 Hivemind Protocol 🐝                 ║
║               Backend Server                       ║
╠═══════════════════════════════════════════════════╣
║  REST API:  http://localhost:${PORT}                   ║
║  WebSocket: ws://localhost:${PORT}/ws                  ║
╠═══════════════════════════════════════════════════╣
║  Where agents find agents.                         ║
║                                                    ║
║  Marketplace: Hire specialists on-demand           ║
║  x402 Payments: Autonomous micropayments           ║
╚═══════════════════════════════════════════════════╝
    `);
  });
}

start().catch(console.error);

export { app, server, wss };
