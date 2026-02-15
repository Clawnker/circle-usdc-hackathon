import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const REGISTRATIONS_PATH = path.join(__dirname, '../../../agents/registrations.json');

let registrationsCache: any[] | null = null;
let registrationsMtimeMs = 0;
let registrationsLoadInFlight: Promise<any[]> | null = null;
let registrationsLoadInFlightMtimeMs = 0;

export async function getRegistrations(): Promise<any[]> {
  const stat = await fs.stat(REGISTRATIONS_PATH);
  const currentMtimeMs = stat.mtimeMs;

  if (registrationsCache && currentMtimeMs === registrationsMtimeMs) {
    return registrationsCache;
  }

  if (registrationsLoadInFlight && currentMtimeMs === registrationsLoadInFlightMtimeMs) {
    return registrationsLoadInFlight;
  }

  const loadPromise = (async () => {
    const raw = await fs.readFile(REGISTRATIONS_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    if (registrationsLoadInFlight === loadPromise) {
      registrationsCache = parsed;
      registrationsMtimeMs = currentMtimeMs;
    }

    return parsed;
  })();

  registrationsLoadInFlight = loadPromise;
  registrationsLoadInFlightMtimeMs = currentMtimeMs;

  try {
    return await loadPromise;
  } finally {
    if (registrationsLoadInFlight === loadPromise) {
      registrationsLoadInFlight = null;
      registrationsLoadInFlightMtimeMs = 0;
    }
  }
}

export function resetRegistrationsCacheForTest() {
  registrationsCache = null;
  registrationsMtimeMs = 0;
  registrationsLoadInFlight = null;
  registrationsLoadInFlightMtimeMs = 0;
}
