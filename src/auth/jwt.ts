import * as jwt from 'jsonwebtoken';
import { config } from '../configuration/config';

/**
 * JWT helpers for the mock server.
 *
 * The mock issues and verifies HS256 tokens with a shared secret. Because this
 * is a mock (not a real identity provider) the token simply carries the claims
 * we want to drive RBAC with:
 *   - `service` : the identity of the calling service (used to gate which
 *                 services may call an endpoint)
 *   - `roles`   : the roles/scopes granted to that caller
 *
 * Tokens are minted with the `npm run token` CLI (see token-cli.ts).
 */

export interface TokenPayload extends jwt.JwtPayload {
  service?: string;
  roles?: string[];
}

export interface MintOptions {
  /** `sub` claim. Defaults to the service name or "mock-user". */
  sub?: string;
  /** `service` claim — the calling service identity. */
  service?: string;
  /** `roles` claim — roles/scopes granted to the caller. */
  roles?: string[];
  /** Token lifetime, e.g. "1h", "30m" or a number of seconds. */
  expiresIn?: string;
}

/** Sign a new mock JWT. */
export function signToken(opts: MintOptions): string {
  const payload: TokenPayload = {};
  if (opts.service) payload.service = opts.service;
  if (opts.roles) payload.roles = opts.roles;

  const signOptions: jwt.SignOptions = {
    algorithm: 'HS256',
    issuer: config.jwt.issuer,
    subject: opts.sub ?? opts.service ?? 'mock-user',
    expiresIn: (opts.expiresIn ?? config.jwt.defaultExpiresIn) as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwt.secret, signOptions);
}

/** Verify a token and return its payload, or throw if invalid/expired. */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],
    issuer: config.jwt.issuer,
  }) as TokenPayload;
}

/**
 * Extract a bearer token from MockServer-style headers
 * (`{ "Authorization": ["Bearer <token>"] }`). Header names are matched
 * case-insensitively because clients send varied casing.
 */
export function extractBearer(headers: Record<string, string[]> | undefined): string | null {
  if (!headers) {
    return null;
  }
  for (const [name, values] of Object.entries(headers)) {
    if (name.toLowerCase() === 'authorization' && values && values.length > 0) {
      const match = /^Bearer\s+(.+)$/i.exec(values[0]);
      return match ? match[1].trim() : null;
    }
  }
  return null;
}

/** RBAC requirements resolved for a single endpoint. */
export interface ResolvedAuth {
  required: boolean;
  /** Caller must hold at least one of these roles (if set). */
  roles?: string[];
  /** Caller's `service` claim must be one of these (if set). */
  services?: string[];
}

export interface AuthResult {
  ok: boolean;
  reason?: string;
}

/** Check a verified token payload against an endpoint's RBAC requirements. */
export function authorize(payload: TokenPayload, auth: ResolvedAuth): AuthResult {
  if (auth.services && auth.services.length > 0) {
    if (!payload.service || !auth.services.includes(payload.service)) {
      return {
        ok: false,
        reason: `service '${payload.service ?? 'none'}' is not allowed (need one of: ${auth.services.join(', ')})`,
      };
    }
  }
  if (auth.roles && auth.roles.length > 0) {
    const held = Array.isArray(payload.roles) ? payload.roles : [];
    if (!auth.roles.some((role) => held.includes(role))) {
      return {
        ok: false,
        reason: `missing required role (need one of: ${auth.roles.join(', ')}; token has: ${held.join(', ') || 'none'})`,
      };
    }
  }
  return { ok: true };
}
