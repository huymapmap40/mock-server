import * as path from 'path';
import * as dotenv from 'dotenv';

// Load variables from the project-level .env file (if present).
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Read an environment variable, falling back to a default when provided.
 * Throws when the variable is missing and no default is given so that
 * misconfiguration fails fast on startup instead of at request time.
 */
function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readBool(name: string, fallback: boolean): boolean {
  return readEnv(name, String(fallback)).toLowerCase() === 'true';
}

export interface CorsConfig {
  enabled: boolean;
  /** Origin allowed to call the mock (must be specific when credentials are on). */
  allowOrigin: string;
  allowMethods: string;
  allowHeaders: string;
  allowCredentials: boolean;
  maxAgeSeconds: number;
}

export interface JwtConfig {
  /** HS256 shared secret used to sign and verify mock tokens. */
  secret: string;
  /** Expected `iss` claim. */
  issuer: string;
  /** Default token lifetime (e.g. "1h", "30m", or seconds as a number). */
  defaultExpiresIn: string;
}

export interface DatadogConfig {
  enabled: boolean;
  /** Datadog API key — get from https://app.datadoghq.com/organization-settings/api-keys */
  apiKey: string;
  /** Datadog intake site, e.g. datadoghq.com or datadoghq.eu */
  site: string;
  /** Logical service name shown in Datadog Log Explorer */
  service: string;
  /** Environment tag, e.g. local, staging, prod */
  env: string;
}

export interface MockServerConfig {
  host: string;
  port: number;
  verbose: boolean;
  trace: boolean;
  /** MockServer (netty jar) version to run. */
  mockServerVersion: string;
  /** Directory holding the per-API YAML contract files. */
  contractsDir: string;
  cors: CorsConfig;
  jwt: JwtConfig;
  datadog: DatadogConfig;
}

export const config: MockServerConfig = {
  host: readEnv('MOCK_SERVER_HOST', 'localhost'),
  // Prefer $PORT (injected by hosts like Render/Heroku); fall back to
  // MOCK_SERVER_PORT for local runs, then the default.
  port: Number(process.env.PORT ?? readEnv('MOCK_SERVER_PORT', '1080')),
  verbose: readBool('MOCK_SERVER_VERBOSE', true),
  trace: readBool('MOCK_SERVER_TRACE', false),
  mockServerVersion: readEnv('MOCK_SERVER_VERSION', '6.1.0'),
  contractsDir: path.resolve(process.cwd(), readEnv('CONTRACTS_DIR', 'expectations')),
  cors: {
    enabled: readBool('CORS_ENABLED', true),
    allowOrigin: readEnv('CORS_ALLOW_ORIGIN', 'http://localhost:3000'),
    allowMethods: readEnv(
      'CORS_ALLOW_METHODS',
      'CONNECT, DELETE, GET, HEAD, OPTIONS, POST, PUT, PATCH, TRACE',
    ),
    allowHeaders: readEnv(
      'CORS_ALLOW_HEADERS',
      'Allow, Content-Encoding, Content-Length, Content-Type, ETag, Expires, Last-Modified, Location, Server, Vary, Authorization',
    ),
    allowCredentials: readBool('CORS_ALLOW_CREDENTIALS', true),
    maxAgeSeconds: Number(readEnv('CORS_MAX_AGE_SECONDS', '300')),
  },
  jwt: {
    secret: readEnv('JWT_SECRET', 'dev-mock-secret-change-me'),
    issuer: readEnv('JWT_ISSUER', 'mock-server'),
    defaultExpiresIn: readEnv('JWT_EXPIRES_IN', '1h'),
  },
  datadog: {
    enabled: readBool('DD_ENABLED', false),
    apiKey: readEnv('DD_API_KEY', ''),
    site: readEnv('DD_SITE', 'datadoghq.com'),
    service: readEnv('DD_SERVICE', 'mock-server'),
    env: readEnv('DD_ENV', 'local'),
  },
};

/** Convenience base URL for logging and documentation. */
export const baseUrl = `http://${config.host}:${config.port}`;
