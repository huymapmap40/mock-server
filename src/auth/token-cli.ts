import { signToken, verifyToken } from './jwt';

/**
 * Mint a mock JWT from the command line so developers can choose exactly which
 * service identity and roles a token grants — this is how you "grant access" to
 * a given caller for RBAC-protected endpoints.
 *
 * Usage:
 *   npm run token -- --service orders --roles orders:read,orders:write
 *   npm run token -- --service billing --roles billing:read --sub alice --expiresIn 30m
 */

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const service = getArg('service');
const sub = getArg('sub');
const expiresIn = getArg('expiresIn');
const rolesArg = getArg('roles');
const roles = rolesArg
  ? rolesArg.split(',').map((r) => r.trim()).filter(Boolean)
  : undefined;

if (!service && !roles) {
  console.error(
    'Provide at least --service or --roles, e.g.\n' +
      '  npm run token -- --service orders --roles orders:read',
  );
  process.exit(1);
}

const token = signToken({ service, sub, roles, expiresIn });

console.log('\nToken (HS256):\n');
console.log(token);
console.log('\nDecoded payload:\n');
console.log(JSON.stringify(verifyToken(token), null, 2));
console.log('\nExample call:\n');
console.log(`  curl -H "Authorization: Bearer ${token}" http://localhost:1080/orders`);
