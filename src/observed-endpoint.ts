import { MockServerClient } from 'mockserver-client';
import { HttpRequest, HttpResponse } from 'mockserver-client/mockServer';
import { log } from './helpers/logger';

/**
 * Example of the websocket request-callback pattern — the Node-side equivalent
 * of MockServer's JVM `logEventListener`.
 *
 * Unlike the YAML contracts (which serve static responses entirely inside the
 * Java process), a callback expectation pushes each matching request over a
 * websocket to this Node process. That lets us run code per request — here,
 * forward a structured log to Datadog via `log` — and then return the response.
 *
 * Trade-off: the callback OWNS the response (it's built in JS, not YAML), so
 * use this only for endpoints where you want a per-request side effect. It is
 * not a passive observer that layers on top of contract expectations.
 */

/** Pull the first value out of MockServer's string-or-{values:[]} fields. */
function firstValue(field: unknown): string | undefined {
  if (typeof field === 'string') return field;
  if (field && typeof field === 'object' && 'values' in (field as Record<string, unknown>)) {
    const values = (field as { values?: unknown[] }).values;
    if (Array.isArray(values) && values.length > 0) return String(values[0]);
  }
  return undefined;
}

export async function registerObservedEndpoint(client: MockServerClient): Promise<void> {
  await client.mockWithCallback(
    // The "event" we listen for: any GET to /observed.
    { method: 'GET', path: '/observed' },
    // Runs in THIS Node process on every match. Must return synchronously, so
    // the log is fire-and-forget (datadog-winston ships it asynchronously).
    (request: HttpRequest): HttpResponse => {
      log.info('observed request', {
        method: firstValue(request.method),
        path: firstValue(request.path),
        query: request.queryStringParameters,
      });

      return {
        statusCode: 200,
        headers: { 'content-type': ['application/json; charset=utf-8'] },
        body: JSON.stringify({ status: 'OK', observed: true }, null, 2),
      };
    },
    // times: handle every request for the life of the server. Must be an
    // unlimited Times object — a large number overflows MockServer's int.
    { unlimited: true },
  );

  log.info('Registered observed endpoint with request callback: GET /observed');
}
