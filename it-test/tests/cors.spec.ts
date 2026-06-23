import { expect, test } from '@playwright/test';

/**
 * CORS — enabled server-wide (src/configuration/config.ts). Every response,
 * plus the OPTIONS preflight, carries the configured CORS headers.
 */
const ORIGIN = process.env.CORS_ALLOW_ORIGIN || 'http://localhost:3000';

test.describe('CORS', () => {
  test('OPTIONS preflight returns the configured CORS headers', async ({ request }) => {
    const res = await request.fetch('/users', {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    });

    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(headers['access-control-allow-credentials']).toBe('true');
    expect(headers['access-control-allow-methods']).toContain('GET');
    expect(headers['access-control-allow-headers']).toContain('Authorization');
  });

  test('normal responses expose the allow-origin header', async ({ request }) => {
    const res = await request.get('/health', { headers: { Origin: ORIGIN } });

    expect(res.status()).toBe(200);
    expect(res.headers()['access-control-allow-origin']).toBe(ORIGIN);
  });
});
