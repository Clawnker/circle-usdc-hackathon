import { expect, test, type Page, type Route } from '@playwright/test';

const PRICING_RESPONSE = {
  pricing: {
    general: { fee: '0' },
    magos: { fee: '0.25' },
    bankr: { fee: '0.10' },
    seeker: { fee: '0.10' },
    scribe: { fee: '0.10' },
  },
};

async function mockPricing(page: Page): Promise<void> {
  await page.route('**/pricing', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PRICING_RESPONSE),
    });
  });
}

function buildRoutePreviewPayload(mode: 'testnet' | 'mainnet', fee: number) {
  return {
    specialist: 'magos',
    fee,
    currency: 'USDC',
    networkMode: mode,
    network: mode === 'mainnet' ? 'base-mainnet' : 'base-sepolia',
    executionSupported: true,
    chainId: mode === 'mainnet' ? 8453 : 84532,
  };
}

async function openDispatchPage(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hivemind Protocol' })).toBeVisible();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

test('persists the selected network mode across reloads', async ({ page }) => {
  await mockPricing(page);

  await openDispatchPage(page);
  await expect(page.getByTestId('network-mode-label')).toHaveText('Base Sepolia (Testnet)');

  await page.getByTestId('network-mode-mainnet').click();
  await expect(page.getByTestId('network-mode-label')).toHaveText('Base Mainnet');

  await page.reload();

  await expect(page.getByTestId('network-mode-label')).toHaveText('Base Mainnet');
});

test('sends mainnet mode on route preview requests from the UI', async ({ page }) => {
  let previewBody: Record<string, unknown> | null = null;

  await mockPricing(page);
  await page.route('**/api/route-preview', async (route) => {
    previewBody = route.request().postDataJSON() as Record<string, unknown>;
    const mode = previewBody.networkMode === 'mainnet' ? 'mainnet' : 'testnet';
    await fulfillJson(route, buildRoutePreviewPayload(mode, 0.25));
  });

  await openDispatchPage(page);
  await page.getByTestId('network-mode-mainnet').click();
  await page.getByTestId('task-input').fill('Check the ETH price');
  await expect(page.getByTestId('task-network-badge')).toHaveText('MAINNET');

  await page.getByTestId('task-submit').click();

  await expect.poll(() => previewBody?.networkMode).toBe('mainnet');
  await expect(page.getByText('Connection Required')).toBeVisible();
});

test('sends the selected network mode through dispatch after a zero-fee preview', async ({ page }) => {
  let dispatchBody: Record<string, unknown> | null = null;

  await mockPricing(page);
  await page.route('**/api/route-preview', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const mode = body.networkMode === 'mainnet' ? 'mainnet' : 'testnet';
    await fulfillJson(route, buildRoutePreviewPayload(mode, 0));
  });
  await page.route('**/dispatch', async (route) => {
    dispatchBody = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, {
      specialist: 'magos',
      fee: 0.4,
    }, 402);
  });

  await openDispatchPage(page);
  await page.getByTestId('task-input').fill('Summarize ETH market structure');
  await expect(page.getByTestId('task-network-badge')).toHaveText('TESTNET');

  await page.getByTestId('task-submit').click();

  await expect.poll(() => dispatchBody?.networkMode).toBe('testnet');
  await expect(page.getByText('Connection Required')).toBeVisible();
});
