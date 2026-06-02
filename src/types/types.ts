/**
 * Minimal, version-stable typings for the subset of the MockServer
 * expectation API that this project uses. We keep our own types here instead
 * of depending on the (loosely typed) shapes shipped by `mockserver-client`,
 * so the rest of the code base stays strongly typed.
 *
 * See the official reference for the full schema:
 * https://app.swaggerhub.com/apis/jamesdbloom/mock-server-openapi/5.15.x
 */

/** Body matcher variants supported by MockServer. */
export type BodyMatcher =
  | { type: 'JSON'; json: unknown; matchType?: 'STRICT' | 'ONLY_MATCHING_FIELDS' }
  | { type: 'JSON_SCHEMA'; jsonSchema: unknown }
  | { type: 'REGEX'; regex: string }
  | { type: 'STRING'; string: string; subString?: boolean };

/** Request matcher. Any omitted field matches anything. */
export interface HttpRequestMatcher {
  method?: string;
  /** Path is matched as a regular expression by MockServer. */
  path?: string;
  /** Map of query parameter name -> list of accepted values (regex-capable). */
  queryStringParameters?: Record<string, string[]>;
  /** Map of header name -> list of accepted values (regex-capable). */
  headers?: Record<string, string[]>;
  body?: BodyMatcher;
}

/** Response that MockServer returns when a request matches. */
export interface HttpResponse {
  statusCode: number;
  /** Map of header name -> list of values to send back. */
  headers?: Record<string, string[]>;
  /** Response body. Use a string (e.g. JSON.stringify) for JSON payloads. */
  body?: string;
  /** Optional artificial delay before responding. */
  delay?: { timeUnit: 'MILLISECONDS' | 'SECONDS'; value: number };
}

/** How many times an expectation may be matched. */
export interface Times {
  remainingTimes?: number;
  unlimited?: boolean;
}

/** A single MockServer expectation (matcher + response). */
export interface Expectation {
  httpRequest: HttpRequestMatcher;
  httpResponse: HttpResponse;
  /** Higher priority expectations are evaluated first. Default is 0. */
  priority?: number;
  times?: Times;
}

/**
 * The request object passed to an object callback. MockServer serializes
 * headers and query parameters as `name -> string[]` maps (header names keep
 * the casing the client sent, so look them up case-insensitively).
 */
export interface CallbackRequest {
  method?: string;
  path?: string;
  headers?: Record<string, string[]>;
  queryStringParameters?: Record<string, string[]>;
  body?: unknown;
}

export type CallbackHandler = (request: CallbackRequest) => HttpResponse | Promise<HttpResponse>;

/** The subset of the mockserver-client surface we rely on. */
export interface MockServerClient {
  /** Register a static expectation served directly by MockServer. */
  mockAnyResponse(expectation: Expectation): Promise<unknown>;
  /**
   * Register an expectation whose response is produced by a callback running
   * in this Node process (used for JWT/RBAC enforcement).
   */
  mockWithCallback(
    request: HttpRequestMatcher,
    handler: CallbackHandler,
    times?: Times,
  ): Promise<unknown>;
  clear(pathOrRequest?: unknown): Promise<unknown>;
  reset(): Promise<unknown>;
}
