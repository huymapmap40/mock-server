import { expect, test } from '@playwright/test';
import { bearer } from '../utils/token';

/**
 * Orders API — declared JWT/RBAC-protected in the contract
 * (expectations/orders/orders/orders.yaml + orders.csv).
 *
 * Tests send a valid token minted exactly like `npm run token` would, with the
 * service + roles the contract documents, and assert the success responses.
 *
 * NOTE: the current runner (src/contracts/register.ts) registers the request /
 * response matchers but does not yet enforce the JWT/RBAC defined in the YAML.
 * The "currently unauthenticated requests succeed" test below pins that real
 * behaviour so it is visible — flip it to expect 401/403 once enforcement lands.
 */
test.describe('Orders API', () => {
  const readToken = () => bearer({ service: 'orders', roles: ['orders:read'] });
  const writeToken = () => bearer({ service: 'orders', roles: ['orders:write'] });

  test('GET /orders with a read token returns the CSV-backed list (10 orders)', async ({
    request,
  }) => {
    const res = await request.get('/orders', { headers: readToken() });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(10);

    // Dotted CSV headers (customer.id, customer.name) build a nested object.
    expect(body[0]).toMatchObject({
      id: 'ord-1',
      total: 42.5,
      status: 'PAID',
      customer: { id: 1, name: 'Ada Lovelace' },
    });
  });

  test('POST /orders with a write token returns 201 CREATED', async ({ request }) => {
    const res = await request.post('/orders', {
      headers: writeToken(),
      data: { total: 50.0, customer: { id: 1 } },
    });

    expect(res.status()).toBe(201);
    expect(await res.json()).toMatchObject({ id: 'ord-3', status: 'CREATED' });
  });

  test('admin-service token is also accepted for the order list', async ({ request }) => {
    const res = await request.get('/orders', {
      headers: bearer({ service: 'admin', roles: ['admin'] }),
    });

    expect(res.status()).toBe(200);
    expect(await res.json()).toHaveLength(10);
  });

  // Documents the CURRENT runtime: RBAC is defined in the contract but not yet
  // enforced, so an unauthenticated request still gets the data back.
  test('unauthenticated GET /orders currently succeeds (RBAC not yet enforced)', async ({
    request,
  }) => {
    const res = await request.get('/orders');
    expect(res.status()).toBe(200);
  });
});
