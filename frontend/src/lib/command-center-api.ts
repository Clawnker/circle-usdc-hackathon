import type { NetworkMode } from '@/types';
import { API_KEY, API_URL, type BazaarAgentPayload } from '@/lib/command-center';

interface JsonResponse<T = unknown> {
  response: Response;
  data: T | null;
}

interface RoutePreviewParams {
  prompt: string;
  hiredAgents: string[];
  networkMode: NetworkMode;
}

interface DispatchPromptParams {
  prompt: string;
  customInstructions: Record<string, string>;
  hiredAgents: string[];
  approvedAgent?: string;
  networkMode: NetworkMode;
  paymentProof?: string;
}

interface DelegatePaymentParams {
  userAddress: string;
  amount: number;
  specialist: string;
  networkMode: NetworkMode;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

function buildJsonHeaders(paymentProof?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  };

  if (paymentProof) {
    headers['X-Payment-Proof'] = paymentProof;
  }

  return headers;
}

export async function fetchRoutePreview(params: RoutePreviewParams): Promise<JsonResponse> {
  const response = await fetch(`${API_URL}/api/route-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  return {
    response,
    data: await readJson(response),
  };
}

export async function requestDelegatedPayment(params: DelegatePaymentParams): Promise<JsonResponse> {
  const response = await fetch(`${API_URL}/api/delegate-pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  return {
    response,
    data: await readJson(response),
  };
}

export async function submitDispatch(params: DispatchPromptParams): Promise<JsonResponse> {
  const response = await fetch(`${API_URL}/dispatch`, {
    method: 'POST',
    headers: buildJsonHeaders(params.paymentProof),
    body: JSON.stringify({
      prompt: params.prompt,
      userId: API_KEY,
      walletUsername: undefined,
      customInstructions: params.customInstructions,
      hiredAgents: params.hiredAgents,
      approvedAgent: params.approvedAgent,
      networkMode: params.networkMode,
    }),
  });

  return {
    response,
    data: await readJson(response),
  };
}

export async function approvePendingTransaction(taskId: string): Promise<Response> {
  return fetch(`${API_URL}/api/transactions/approve`, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ taskId }),
  });
}

export async function rejectPendingTransaction(taskId: string): Promise<Response> {
  return fetch(`${API_URL}/api/transactions/reject`, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ taskId }),
  });
}

export async function registerExternalAgent(
  agentPayload: BazaarAgentPayload,
  capabilities: string[],
): Promise<JsonResponse> {
  const response = await fetch(`${API_URL}/api/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...agentPayload, capabilities }),
  });

  return {
    response,
    data: await readJson(response),
  };
}
