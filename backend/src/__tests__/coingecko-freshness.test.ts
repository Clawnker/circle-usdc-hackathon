import axios from 'axios';
import { getPrice } from '../specialists/tools/coingecko';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CoinGecko freshness behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when strict fresh mode is requested and CoinGecko fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('rate limited'));
    await expect(getPrice('ETH', { allowStaleFallback: false })).rejects.toThrow(/rate limited/i);
  });

  it('keeps backward compatibility with mock fallback by default', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('rate limited'));
    const data = await getPrice('ETH');
    expect(data.token).toBe('ETH');
    expect(data.price).toBeGreaterThan(0);
  });
});
