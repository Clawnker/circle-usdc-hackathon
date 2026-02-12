
import { routePrompt } from './dispatcher';
import { SpecialistType } from './types';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
  const prompt = "where is the deepest liquidity for the clawnch token on base";
  const hiredAgents: SpecialistType[] = ['silverback', 'bankr', 'magos', 'seeker'];

  console.log(`Testing routing for: "${prompt}"`);
  console.log(`Hired agents: ${hiredAgents.join(', ')}`);

  try {
    const result = await routePrompt(prompt, hiredAgents);
    console.log(`Result: ${result}`);
  } catch (err) {
    console.error(err);
  }
}

run();
