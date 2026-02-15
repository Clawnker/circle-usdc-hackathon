import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

function isUnsafeIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;

  const [a, b] = parts;

  if (a === 0) return true; // unspecified
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224 && a <= 239) return true; // multicast
  if (a >= 240) return true; // reserved/broadcast

  return false;
}

function isUnsafeIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true; // unspecified
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true; // loopback
  if (normalized.startsWith('ff')) return true; // multicast ff00::/8
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true; // link-local fe80::/10
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7

  // IPv4-mapped IPv6, e.g. ::ffff:127.0.0.1
  const v4MappedMatch = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4MappedMatch) {
    return isUnsafeIpv4(v4MappedMatch[1]);
  }

  return false;
}

export function isUnsafeIp(ip: string): boolean {
  const family = isIP(ip);
  if (!family) return true;
  if (family === 4) return isUnsafeIpv4(ip);
  return isUnsafeIpv6(ip);
}

export async function resolveAndValidateHost(hostname: string): Promise<string[]> {
  if (hostname.toLowerCase() === 'localhost') {
    throw new Error('Endpoint host resolves to localhost');
  }

  const literalFamily = isIP(hostname);
  if (literalFamily) {
    if (isUnsafeIp(hostname)) {
      throw new Error(`Endpoint IP is not allowed: ${hostname}`);
    }
    return [hostname];
  }

  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length) {
    throw new Error('Endpoint host did not resolve to any IPs');
  }

  const ips = [...new Set(records.map(r => r.address))];
  for (const ip of ips) {
    if (isUnsafeIp(ip)) {
      throw new Error(`Endpoint host resolves to disallowed IP: ${ip}`);
    }
  }

  return ips;
}

export async function validateExternalEndpointUrl(endpoint: string): Promise<{ url: URL; resolvedIps: string[] }> {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('Invalid endpoint URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Endpoint must use http or https');
  }

  if (url.username || url.password) {
    throw new Error('Endpoint credentials are not allowed');
  }

  const resolvedIps = await resolveAndValidateHost(url.hostname);
  return { url, resolvedIps };
}

export async function revalidateEndpointResolution(endpoint: URL, expectedIps: string[]): Promise<string[]> {
  const currentIps = await resolveAndValidateHost(endpoint.hostname);
  const overlap = currentIps.some(ip => expectedIps.includes(ip));

  if (!overlap) {
    throw new Error('Endpoint DNS rebinding detected');
  }

  return currentIps;
}
