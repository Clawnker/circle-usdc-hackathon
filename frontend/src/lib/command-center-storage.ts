import type { NetworkMode, QueryHistoryItem } from '@/types';
import {
  NETWORK_MODE_EVENT,
  NETWORK_MODE_STORAGE_KEY,
  getModeScopedStorageKey,
  resolveNetworkMode,
} from '@/lib/networkMode';
import {
  DEFAULT_SWARM_AGENTS,
  type RegistryMetaMap,
} from '@/lib/command-center';

const QUERY_HISTORY_STORAGE_KEY = 'queryHistory';
const SWARM_STORAGE_KEY = 'hivemind-swarm';
const REGISTRY_META_STORAGE_KEY = 'hivemind-registry-meta';
const CUSTOM_INSTRUCTIONS_STORAGE_KEY = 'hivemind-custom-instructions';

function readJson<T>(storageKey: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function writeJson(storageKey: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

export function loadInitialNetworkMode(): NetworkMode {
  if (typeof window === 'undefined') {
    return 'testnet';
  }

  return resolveNetworkMode(window.localStorage.getItem(NETWORK_MODE_STORAGE_KEY));
}

export function persistNetworkMode(mode: NetworkMode): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(NETWORK_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(NETWORK_MODE_EVENT, { detail: mode }));
}

export function loadHiredAgents(mode: NetworkMode): string[] {
  return readJson(getModeScopedStorageKey(SWARM_STORAGE_KEY, mode), [...DEFAULT_SWARM_AGENTS]);
}

export function persistHiredAgents(mode: NetworkMode, hiredAgents: string[]): void {
  writeJson(getModeScopedStorageKey(SWARM_STORAGE_KEY, mode), hiredAgents);
}

export function loadRegistryMeta(mode: NetworkMode): RegistryMetaMap {
  return readJson(getModeScopedStorageKey(REGISTRY_META_STORAGE_KEY, mode), {});
}

export function persistRegistryMeta(mode: NetworkMode, registryMeta: RegistryMetaMap): void {
  writeJson(getModeScopedStorageKey(REGISTRY_META_STORAGE_KEY, mode), registryMeta);
}

export function loadCustomInstructions(mode: NetworkMode): Record<string, string> {
  return readJson(getModeScopedStorageKey(CUSTOM_INSTRUCTIONS_STORAGE_KEY, mode), {});
}

export function persistCustomInstructions(mode: NetworkMode, customInstructions: Record<string, string>): void {
  writeJson(getModeScopedStorageKey(CUSTOM_INSTRUCTIONS_STORAGE_KEY, mode), customInstructions);
}

export function loadQueryHistory(): QueryHistoryItem[] {
  return readJson<QueryHistoryItem[]>(QUERY_HISTORY_STORAGE_KEY, []);
}

export function persistQueryHistory(queryHistory: QueryHistoryItem[]): void {
  writeJson(QUERY_HISTORY_STORAGE_KEY, queryHistory);
}
