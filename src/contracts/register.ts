import { HttpResponse } from '../types/types';
import { MockServerClient } from 'mockserver-client';
import { authorize, extractBearer, ResolvedAuth, verifyToken } from '../auth/jwt';
import { LoadedContract } from './schema';
import { toRequestMatcher, toResponse } from './convert';

function jsonError(status: number, error: string, message: string): HttpResponse {
  return {
    statusCode: status,
    headers: { 'content-type': ['application/json; charset=utf-8'] },
    body: JSON.stringify({ status: 'ERROR', error, code: status, message }, null, 2),
  };
}

export interface RegisterSummary {
  files: number;
  total: number;
  authProtected: number;
}

/**
 * Reset the server and (re)register every expectation from the loaded
 * contracts. Calling reset() first makes a redeploy idempotent: restarting the
 * runner always reloads the full, current set of contracts.
 */
export async function registerContracts(
  client: MockServerClient,
  contracts: LoadedContract[],
): Promise<RegisterSummary> {
  await client.reset();

  let total = 0;
  let authProtected = 0;

  for (const contract of contracts) {
    for (const expectation of contract.expectations) {
      const request = toRequestMatcher(expectation.request);
      const response = toResponse(expectation.response);

      await client.mockAnyResponse({
        httpRequest: request,
        httpResponse: response,
        priority: expectation.priority ?? 0,
        times: { unlimited: true },
      });

      total += 1;
    }
  }

  return { files: contracts.length, total, authProtected };
}
