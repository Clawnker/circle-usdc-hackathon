
import { capabilityMatcher } from './capability-matcher';
import { routePrompt } from './dispatcher';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
  console.log("Initializing...");
  // Allow time for embeddings to load
  await new Promise(r => setTimeout(r, 2000));

  // Simulate Minara registration (if not already there)
  // We can't easily register via this script without mocking external-agents module fully or running server
  // But we can check if capabilityMatcher finds it if we pass a mock intent

  const prompt = "market analysis";
  console.log(`\nQuery: "${prompt}"`);
  
  try {
    const intent = await capabilityMatcher.extractIntent(prompt);
    console.log("Extracted Intent:", intent);

    const matches = await capabilityMatcher.matchAgents(intent);
    console.log("\nAll Matches:", matches.map(m => `${m.agentId} (${m.score.toFixed(2)})`).join(', '));

    // Simulate hiredAgents = ['minara']
    const hired = ['minara'];
    const filtered = matches.filter(m => hired.includes(m.agentId));
    console.log("\nFiltered (hired=['minara']):", filtered.map(m => `${m.agentId} (${m.score.toFixed(2)})`).join(', '));

  } catch (err) {
    console.error(err);
  }
}

run();
