/**
 * Shape of the per-API YAML contract files found in the contracts directory.
 * Each file describes one service/API and all of its mocked cases.
 */

export interface YamlAuth {
  /** Whether a valid JWT is required. Defaults to true when an auth block exists. */
  required?: boolean;
  /** Caller must hold at least one of these roles. */
  roles?: string[];
  /** Caller's `service` claim must be one of these. */
  services?: string[];
}

export interface YamlRequest {
  method?: string;
  /** Matched as a regular expression by MockServer (e.g. "/users/[0-9]+"). */
  path?: string;
  /** Query parameters. Values are regex-capable. */
  query?: Record<string, string | string[]>;
  /** Request headers to match. Values are regex-capable. */
  headers?: Record<string, string | string[]>;
  /** Match the body as JSON (only the given fields must be present). */
  body?: unknown;
  /** Match the body against a regular expression. */
  bodyRegex?: string;
  /** Match the body against an exact string. */
  bodyText?: string;
  /** Match the body against a JSON schema. */
  bodySchema?: unknown;
}

export interface YamlResponse {
  /** HTTP status code to return. */
  status: number;
  headers?: Record<string, string | string[]>;
  /** JSON body (serialized automatically; sets a JSON content-type). */
  json?: unknown;
  /** Raw text body. */
  text?: string;
  /** Artificial delay in milliseconds before responding. */
  delayMs?: number;
}

export interface YamlExpectation {
  description?: string;
  /** Higher priority is matched first (default 0). */
  priority?: number;
  request: YamlRequest;
  response: YamlResponse;
  /** Per-endpoint auth/RBAC override (merged over the file's defaultAuth). */
  auth?: YamlAuth;
}

export interface YamlContract {
  /** Logical name of the API/service this file mocks. */
  service: string;
  /** Auth applied to every expectation in the file unless overridden. */
  defaultAuth?: YamlAuth;
  expectations: YamlExpectation[];
}

/** A parsed contract plus the file it came from (for error messages). */
export interface LoadedContract extends YamlContract {
  sourceFile: string;
}

/**
 * Validate the raw parsed YAML for one file. Throws a descriptive error so a
 * bad contract fails the deploy loudly instead of silently dropping mocks.
 */
export function validateContract(raw: unknown, file: string): YamlContract {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`${file}: file must be a YAML object`);
  }
  const contract = raw as Partial<YamlContract>;
  if (typeof contract.service !== 'string' || contract.service.trim() === '') {
    throw new Error(`${file}: missing required "service" field`);
  }
  if (!Array.isArray(contract.expectations) || contract.expectations.length === 0) {
    throw new Error(`${file}: "expectations" must be a non-empty array`);
  }
  contract.expectations.forEach((exp, i) => {
    const where = `${file} -> expectations[${i}]${exp?.description ? ` (${exp.description})` : ''}`;
    if (!exp || typeof exp !== 'object') {
      throw new Error(`${where}: must be an object`);
    }
    if (!exp.request || typeof exp.request !== 'object') {
      throw new Error(`${where}: missing "request"`);
    }
    if (!exp.response || typeof exp.response !== 'object') {
      throw new Error(`${where}: missing "response"`);
    }
    if (typeof exp.response.status !== 'number') {
      throw new Error(`${where}: "response.status" must be a number`);
    }
  });
  return contract as YamlContract;
}
