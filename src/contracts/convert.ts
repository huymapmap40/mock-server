import { BodyMatcher, HttpRequestMatcher, HttpResponse } from '../types/types';
import { ResolvedAuth } from '../auth/jwt';
import { YamlAuth, YamlRequest, YamlResponse } from './schema';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

/** Normalize a `name -> value|values` map into MockServer's `name -> values[]`. */
function toMultiMap(
  input?: Record<string, string | string[]>,
): Record<string, string[]> | undefined {
  if (!input) {
    return undefined;
  }
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = Array.isArray(value) ? value.map(String) : [String(value)];
  }
  return out;
}

function hasHeader(headers: Record<string, string[]>, name: string): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

function toBodyMatcher(req: YamlRequest): BodyMatcher | undefined {
  if (req.bodyRegex !== undefined) {
    return { type: 'REGEX', regex: req.bodyRegex };
  }
  if (req.bodyText !== undefined) {
    return { type: 'STRING', string: req.bodyText };
  }
  if (req.bodySchema !== undefined) {
    return { type: 'JSON_SCHEMA', jsonSchema: req.bodySchema };
  }
  if (req.body !== undefined) {
    return { type: 'JSON', json: req.body, matchType: 'ONLY_MATCHING_FIELDS' };
  }
  return undefined;
}

/** Convert a YAML request block into a MockServer request matcher. */
export function toRequestMatcher(req: YamlRequest): HttpRequestMatcher {
  const matcher: HttpRequestMatcher = {};
  if (req.method) {
    matcher.method = req.method;
  }
  if (req.path) {
    matcher.path = req.path;
  }
  const query = toMultiMap(req.query);
  if (query) {
    matcher.queryStringParameters = query;
  }
  const headers = toMultiMap(req.headers);
  if (headers) {
    matcher.headers = headers;
  }
  const body = toBodyMatcher(req);
  if (body) {
    matcher.body = body;
  }
  return matcher;
}

/**
 * Resolve the JSON payload for a response, folding in CSV data when present.
 *
 * - no data            -> the inline `json` (or undefined)
 * - data, no dataKey   -> the rows array itself
 * - data, with dataKey -> the inline `json` object with `rows` under dataKey
 */
function resolveJsonBody(res: YamlResponse): unknown {
  if (!res.data) {
    return res.json;
  }
  if (res.dataKey) {
    const base = (res.json && typeof res.json === 'object') ? res.json : {};
    return { ...(base as Record<string, unknown>), [res.dataKey]: res.data };
  }
  return res.data;
}

/** Convert a YAML response block into a MockServer response. */
export function toResponse(res: YamlResponse): HttpResponse {
  const headers = toMultiMap(res.headers) ?? {};
  let body: string | undefined;

  const json = resolveJsonBody(res);
  if (json !== undefined) {
    body = JSON.stringify(json, null, 2);
    if (!hasHeader(headers, 'content-type')) {
      headers['content-type'] = [JSON_CONTENT_TYPE];
    }
  } else if (res.text !== undefined) {
    body = res.text;
  }

  const response: HttpResponse = { statusCode: res.status, headers, body };
  if (res.delayMs) {
    response.delay = { timeUnit: 'MILLISECONDS', value: res.delayMs };
  }
  return response;
}

/**
 * Merge a file-level defaultAuth with an endpoint-level auth override and
 * resolve whether auth is actually required. Returns null when no auth applies.
 */
export function resolveAuth(
  defaultAuth?: YamlAuth,
  ownAuth?: YamlAuth,
): ResolvedAuth | null {
  if (!defaultAuth && !ownAuth) {
    return null;
  }
  const merged: YamlAuth = { ...defaultAuth, ...ownAuth };
  const required = merged.required !== false;
  if (!required) {
    return null;
  }
  return { required: true, roles: merged.roles, services: merged.services };
}
