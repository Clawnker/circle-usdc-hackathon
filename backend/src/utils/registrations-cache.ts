import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const REGISTRATIONS_PATH = path.join(__dirname, '../../../agents/registrations.json');

let registrationsCache: any[] | null = null;
let registrationsMtimeMs = 0;

export async function getRegistrations(): Promise<any[]> {
  const stat = await fs.stat(REGISTRATIONS_PATH);
  if (!registrationsCache || stat.mtimeMs !== registrationsMtimeMs) {
    const raw = await fs.readFile(REGISTRATIONS_PATH, 'utf8');
    registrationsCache = JSON.parse(raw);
    registrationsMtimeMs = stat.mtimeMs;
  }
  return registrationsCache;
}

export function resetRegistrationsCacheForTest() {
  registrationsCache = null;
  registrationsMtimeMs = 0;
}
