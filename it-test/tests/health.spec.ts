import { expect, test } from '@playwright/test';

/**
 * Health API — public (no auth). One endpoint with three response cases
 * selected by the `scenario` query parameter (priority decides which matches).
 * Contract: expectations/health/health/health.yaml (+ health.csv).
 */
test.describe('Health API', () => {
  test('GET /health returns 200 UP with CSV-backed dependencies', async ({ request }) => {
    const res = await request.get('/health');

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');

    const body = await res.json();
    expect(body.status).toBe('UP');
    expect(body.service).toBe('mock-external-service');

    // `dependencies` is the CSV envelope key (dataKey) — one row per dependency.
    expect(Array.isArray(body.dependencies)).toBe(true);
    expect(body.dependencies).toHaveLength(5);

    const database = body.dependencies.find((d: { name: string }) => d.name === 'database');
    expect(database).toMatchObject({ name: 'database', status: 'UP', latencyMs: 12 });

    const auth = body.dependencies.find((d: { name: string }) => d.name === 'auth');
    expect(auth).toMatchObject({ status: 'DEGRADED', latencyMs: 140 });
  });

  test('GET /health?scenario=server-error returns 500 DOWN', async ({ request }) => {
    const res = await request.get('/health', { params: { scenario: 'server-error' } });

    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'DOWN', code: 500, error: 'Internal Server Error' });
  });

  test('GET /health?scenario=client-error returns 400 ERROR', async ({ request }) => {
    const res = await request.get('/health', { params: { scenario: 'client-error' } });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ERROR', code: 400, error: 'Bad Request' });
  });
});
