export interface ParsedPaymentRequired {
  raw: any;
  x402Version: number;
  option: any;
  amount?: string;
  network?: string;
  recipient?: string;
}

function decodeHeader(rawHeader: string): any {
  const trimmed = (rawHeader || '').trim();
  if (!trimmed) throw new Error('Empty payment-required header');

  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }

  const padded = trimmed + '='.repeat((4 - (trimmed.length % 4)) % 4);
  try {
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    if (decoded.trim().startsWith('{')) {
      return JSON.parse(decoded);
    }
  } catch {
    // Fall through to raw JSON parse below.
  }

  return JSON.parse(trimmed);
}

export function parsePaymentRequiredHeader(header: string): ParsedPaymentRequired {
  const raw = decodeHeader(header);
  const accepts: any[] = Array.isArray(raw?.accepts) ? raw.accepts : [];

  const option =
    accepts.find((a) => a?.scheme === 'exact' && a?.network === 'eip155:8453') ||
    accepts[0];

  if (!option) {
    throw new Error('payment-required missing accepts[] options');
  }

  return {
    raw,
    x402Version: Number(raw?.x402Version ?? 1),
    option,
    amount: option?.maxAmountRequired ?? option?.amount,
    network: option?.network,
    recipient: option?.recipient ?? option?.payTo ?? option?.to,
  };
}
