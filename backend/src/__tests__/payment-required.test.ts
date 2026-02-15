import { parsePaymentRequiredHeader } from '../utils/payment-required';

describe('payment-required parser', () => {
  const payload = {
    x402Version: 2,
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '150000',
        payTo: '0x1234567890123456789012345678901234567890',
      },
    ],
  };

  test('parses base64 encoded JSON header', () => {
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    const out = parsePaymentRequiredHeader(encoded);

    expect(out.amount).toBe('150000');
    expect(out.network).toBe('eip155:8453');
    expect(out.recipient).toBe('0x1234567890123456789012345678901234567890');
    expect(out.x402Version).toBe(2);
  });

  test('parses raw JSON header', () => {
    const out = parsePaymentRequiredHeader(JSON.stringify(payload));

    expect(out.amount).toBe('150000');
    expect(out.recipient).toBe('0x1234567890123456789012345678901234567890');
  });

  test('normalizes recipient field when server uses recipient key', () => {
    const header = JSON.stringify({
      x402Version: 1,
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          maxAmountRequired: '42',
          recipient: '0x0000000000000000000000000000000000000042',
        },
      ],
    });

    const out = parsePaymentRequiredHeader(header);
    expect(out.amount).toBe('42');
    expect(out.recipient).toBe('0x0000000000000000000000000000000000000042');
  });

  test('throws on missing accepts options', () => {
    expect(() => parsePaymentRequiredHeader(JSON.stringify({ x402Version: 2 }))).toThrow(
      'payment-required missing accepts[] options'
    );
  });
});
