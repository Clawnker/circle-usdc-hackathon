export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (ctx: { attempt: number; error: any; delayMs: number }) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientError(error: any): boolean {
  const message = String(error?.message || error || '').toLowerCase();
  return [
    'timeout',
    'timed out',
    'etimedout',
    'econnreset',
    'eai_again',
    'network',
    'temporar',
    '429',
    '502',
    '503',
    '504',
    'rate limit',
  ].some((needle) => message.includes(needle));
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? Number(process.env.RETRY_MAX_ATTEMPTS || 3);
  const baseDelayMs = options.baseDelayMs ?? Number(process.env.RETRY_BASE_DELAY_MS || 250);
  const maxDelayMs = options.maxDelayMs ?? Number(process.env.RETRY_MAX_DELAY_MS || 2000);
  const shouldRetry = options.shouldRetry ?? isTransientError;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const canRetry = attempt < maxAttempts && shouldRetry(error);
      if (!canRetry) break;

      const rawDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(rawDelay * 0.2)));
      const delayMs = rawDelay + jitter;
      options.onRetry?.({ attempt, error, delayMs });
      await sleep(delayMs);
    }
  }

  throw lastError;
}
