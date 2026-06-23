import { expect, test } from '@playwright/test';

/**
 * Users API — public (no auth). Demonstrates a CSV-backed list, regex path
 * matching and regex body matching.
 * Contract: expectations/users/users/users.yaml (+ users.csv).
 */
test.describe('Users API', () => {
  test('GET /users returns the full CSV-backed list (10 users)', async ({ request }) => {
    const res = await request.get('/users');

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(10);

    // Values are coerced from the CSV: id -> number, active -> boolean.
    expect(body[0]).toMatchObject({
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      active: true,
    });
    expect(body[6]).toMatchObject({ id: 7, name: 'John McCarthy', active: false });
  });

  test('GET /users/:id matches any numeric id (regex path) and returns the canned user', async ({
    request,
  }) => {
    for (const id of ['1', '7', '999']) {
      const res = await request.get(`/users/${id}`);
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual({
        id: '1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      });
    }
  });

  test('POST /users with a valid email returns 201 created (regex body match)', async ({
    request,
  }) => {
    const res = await request.post('/users', {
      data: { name: 'Grace', email: 'grace@example.com' },
    });

    expect(res.status()).toBe(201);
    expect(await res.json()).toMatchObject({ id: '2', status: 'created' });
  });

  test('POST /users without a valid email is rejected with 422', async ({ request }) => {
    const res = await request.post('/users', { data: { name: 'No Email Here' } });

    expect(res.status()).toBe(422);
    expect(await res.json()).toMatchObject({ status: 'ERROR', code: 422 });
  });
});
