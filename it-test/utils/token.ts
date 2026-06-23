import * as jwt from 'jsonwebtoken';

/**
 * Mint mock JWTs for the RBAC-protected contracts (e.g. the Orders API).
 *
 * This mirrors src/auth/jwt.ts (HS256, same secret + issuer) so tests can
 * present a token exactly as the `npm run token` CLI would produce one:
 *
 *   npm run token -- --service orders --roles orders:read,orders:write
 */

const SECRET = process.env.JWT_SECRET || 'dev-mock-secret-change-me';
const ISSUER = process.env.JWT_ISSUER || 'mock-server';

export interface MintOptions {
  service?: string;
  roles?: string[];
  sub?: string;
  expiresIn?: string;
}

/** Sign a mock HS256 token carrying `service` + `roles` claims. */
export function mintToken(opts: MintOptions = {}): string {
  const payload: Record<string, unknown> = {};
  if (opts.service) payload.service = opts.service;
  if (opts.roles) payload.roles = opts.roles;

  return jwt.sign(payload, SECRET, {
    algorithm: 'HS256',
    issuer: ISSUER,
    subject: opts.sub ?? opts.service ?? 'mock-user',
    expiresIn: (opts.expiresIn ?? '1h') as jwt.SignOptions['expiresIn'],
  });
}

/** Authorization header for a freshly minted token. */
export function bearer(opts: MintOptions = {}): Record<string, string> {
  return { Authorization: `Bearer ${mintToken(opts)}` };
}
