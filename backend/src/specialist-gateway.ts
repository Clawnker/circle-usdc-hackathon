import {
  SpecialistResult,
  SpecialistType,
} from './types';
import config from './config';
import { getReliabilityConfig } from './reliability/config';
import { enqueueDlq } from './reliability/dlq';
import { withRetry, isTransientError } from './reliability/retry';
import { callExternalAgent, getExternalAgent } from './external-agents';
import { getNetworkConfig } from './utils/network-config';
import type { ClientNetworkMode } from './utils/client-network';
import { routeWithRegExp } from './routing';
import magos from './specialists/magos';
import aura from './specialists/aura';
import bankr from './specialists/bankr';
import scribe from './specialists/scribe';
import seeker from './specialists/seeker';

function resolveTaskNetworkMode(input?: unknown): ClientNetworkMode {
  return input === 'mainnet' ? 'mainnet' : 'testnet';
}

function formatObjectReadable(value: any): string {
  if (!value || typeof value !== 'object') return String(value || '');

  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .slice(0, 8)
    .map(([key, entryValue]) => {
      if (Array.isArray(entryValue)) {
        return `• ${key}: ${entryValue.slice(0, 4).map((item) => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ')}`;
      }

      if (typeof entryValue === 'object') {
        const nested = Object.entries(entryValue as Record<string, any>)
          .slice(0, 4)
          .map(([nestedKey, nestedValue]) => `${nestedKey}=${typeof nestedValue === 'object' ? JSON.stringify(nestedValue) : String(nestedValue)}`)
          .join(', ');
        return `• ${key}: ${nested}`;
      }

      return `• ${key}: ${String(entryValue)}`;
    });

  return entries.length > 0 ? entries.join('\n') : 'No details provided.';
}

export function extractResponseContent(result: SpecialistResult): string {
  const data = result.data;
  if (data?.combined) return data.combined;
  if (data?.summary) return data.summary;
  if (data?.insight) return data.insight;
  if (data?.reasoning) return data.reasoning;

  if (data?.externalAgent) {
    const agentData = data?.data || data;
    const analysis = agentData?.analysis;
    if (analysis) {
      let content = `**${data.externalAgent} Security Audit**\n\n`;
      if (analysis.summary) content += `${analysis.summary}\n\n`;
      if (analysis.score !== undefined) content += `**Score:** ${analysis.score}/100\n\n`;
      if (analysis.findings && analysis.findings.length > 0) {
        content += '**Findings:**\n';
        analysis.findings.forEach((finding: any) => {
          content += `- **[${finding.severity || 'Unknown'}]** ${finding.title || finding.description || JSON.stringify(finding)}\n`;
          if (finding.recommendation) content += `  -> ${finding.recommendation}\n`;
        });
        content += '\n';
      }
      if (analysis.gasOptimizations && analysis.gasOptimizations.length > 0) {
        content += '**Gas Optimizations:**\n';
        analysis.gasOptimizations.forEach((optimization: string) => {
          content += `- ${optimization}\n`;
        });
        content += '\n';
      }
      if (analysis.bestPractices) {
        content += '**Best Practices:**\n';
        Object.entries(analysis.bestPractices).forEach(([key, value]) => {
          content += `- ${key}: ${value}\n`;
        });
      }
      return content.trim();
    }

    if (typeof agentData === 'string') return agentData;
    if (agentData?.output) return agentData.output;
    if (agentData?.response) {
      return typeof agentData.response === 'string'
        ? agentData.response
        : formatObjectReadable(agentData.response);
    }
    return formatObjectReadable(agentData);
  }

  if (data?.details?.summary) return data.details.summary;
  if (data?.details?.response) {
    return typeof data.details.response === 'string'
      ? data.details.response
      : formatObjectReadable(data.details.response);
  }

  if (data?.trending && Array.isArray(data.trending)) {
    return `**Trending Topics**:\n${data.trending.slice(0, 3).map((item: any) => `- ${item.topic || item.name}`).join('\n')}`;
  }

  if (data?.type) {
    return `${data.type} ${data.status || 'completed'}${data.txSignature ? ` (tx: ${data.txSignature.slice(0, 16)}...)` : ''}`;
  }

  if (data && typeof data === 'object') {
    const readable = formatObjectReadable(data);
    if (readable && readable !== '[object Object]') return readable;
  }

  return result.success
    ? "I'm not sure how to help with that. Try asking about wallet balances, market analysis, or social sentiment."
    : 'Task failed';
}

export async function callSpecialistGated(specialistId: string, prompt: string, context?: any): Promise<SpecialistResult> {
  const startTime = Date.now();
  const retryEnabled = getReliabilityConfig().featureFlags.enableRetry;

  try {
    console.log(`[x402-Client] Requesting gated access to ${specialistId}...`);

    const invoke = async () => {
      const result = await callSpecialist(specialistId as SpecialistType, prompt, context);
      if (!result.success && isTransientError(result?.data?.error || result?.data?.details?.error || '')) {
        throw new Error(String(result?.data?.error || result?.data?.details?.error || 'Transient specialist failure'));
      }
      return result;
    };

    const result = retryEnabled
      ? await withRetry(invoke, {
          onRetry: ({ attempt, error, delayMs }) => {
            console.warn(`[Retry] ${specialistId} attempt ${attempt} failed: ${error?.message || error}. Retrying in ${delayMs}ms`);
          },
        })
      : await invoke();

    return {
      ...result,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    const transient = isTransientError(error);
    if (transient) {
      enqueueDlq({
        taskId: context?.id,
        specialist: specialistId,
        reason: error?.message || 'Transient specialist failure',
        transient,
        payload: { prompt: String(prompt).slice(0, 500) },
      });
    }

    return {
      success: false,
      data: { error: error.message, transient },
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export async function callSpecialist(specialist: SpecialistType, prompt: string, context?: any): Promise<SpecialistResult> {
  const startTime = Date.now();
  const networkMode = resolveTaskNetworkMode(context?.metadata?.networkMode);
  const network = getNetworkConfig(networkMode);

  if (getExternalAgent(specialist as string, networkMode)) {
    console.log(`[Dispatcher] Routing to external agent: ${specialist}`);
    const externalResult = await callExternalAgent(specialist as string, prompt, undefined, networkMode);

    if (!externalResult.success && !externalResult.cost) {
      console.log(`[Dispatcher] External agent ${specialist} failed, falling back to internal routing`);
      const fallbackSpecialist = routeWithRegExp(prompt);
      console.log(`[Dispatcher] Fallback to internal specialist: ${fallbackSpecialist}`);
      return callSpecialist(fallbackSpecialist, prompt, context);
    }

    return externalResult;
  }

  let result: SpecialistResult;

  switch (specialist) {
    case 'magos':
      result = await magos.handle(prompt);
      break;

    case 'aura':
      result = await aura.handle(prompt);
      break;

    case 'bankr':
      result = await bankr.handle(prompt, context);
      break;

    case 'scribe':
      result = await scribe.handle(prompt);
      break;

    case 'seeker':
      result = await seeker.handle(prompt);
      break;

    case 'general':
    default: {
      const [magosResult, auraResult] = await Promise.all([
        magos.handle(prompt),
        aura.handle(prompt),
      ]);

      result = {
        success: true,
        data: {
          magos: magosResult.data,
          aura: auraResult.data,
          combined: "I'm not sure how to help with that. Try asking about wallet balances, market analysis, or social sentiment.",
        },
        confidence: ((magosResult.confidence || 0) + (auraResult.confidence || 0)) / 2,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
      break;
    }
  }

  if (result.data && typeof result.data === 'object') {
    result.data.agentId = specialist;
  }

  if (result && !result.cost) {
    const fee = (config.fees as any)[specialist];
    if (fee !== undefined) {
      result.cost = {
        amount: String(fee),
        currency: 'USDC',
        network: network.routeLabel,
        recipient: config.specialistWallets[specialist] || 'treasury',
      };
    }
  }

  return result;
}
