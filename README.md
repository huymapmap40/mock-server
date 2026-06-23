# Mock Server

A contract-based HTTP **mock server** built on top of
[MockServer](https://www.mock-server.com/), written in **TypeScript** and run
via the [`mockserver-node`](https://mock-server.com/mock_server/running_mock_server.html#mockserver_node)
module.

## Live demo

A running instance is deployed on [Render](https://render.com):

- **Dashboard:** https://mock-server-y8ct.onrender.com/mockserver/dashboard

Send a few requests, then refresh the dashboard to watch them logged live:

```bash
curl --location 'https://mock-server-y8ct.onrender.com/orders'
curl --location 'https://mock-server-y8ct.onrender.com/users'
curl --location 'https://mock-server-y8ct.onrender.com/health'
```

> **⚠️ Cold start:** the free Render tier spins the service down after a period
> of inactivity. The **first** request after idle can take **≥ 50 seconds**
> while the instance wakes up. Let it complete, then go back and refresh the
> dashboard to see the request appear.

## Why

It lets the development team build and test against external APIs **before they
are ready** in test / staging / production. You describe the expected responses
based on the **API contract** in YAML, start the mock server, and your
application integrates against realistic, deterministic responses.

Features:

- **YAML-defined contracts** — one file per API, all response cases in one place.
- **Reload-on-redeploy** — every restart resets and reloads the full contract set.
- **Regex matching** — on path, query, headers, and request body.
- **CORS** — enabled for all responses, pinned to a specific origin (+ credentials).
- **JWT auth + RBAC** — protect endpoints by service identity and roles, with a
  CLI to mint tokens.

## Requirements

- **Node.js** 16+ (developed against Node 18)
- **Java** 8+ on the `PATH` — MockServer runs on the JVM. Check with `java -version`.
- Internet access on the **first run only** (downloads/caches the MockServer jar).

## Project layout

```
mock-server/
├── .env.example                # Configuration template (copy to .env)
├── expectations/               # YAML contracts — one file per API
│   ├── health.yaml             #   public, multi-case (200/4xx/5xx)
│   ├── users.yaml              #   public, regex matching demo
│   └── orders.yaml             #   JWT + RBAC protected demo
├── it-test/                    # Playwright integration tests (see below)
│   ├── playwright.config.ts    #   boots the server via webServer, then tests
│   ├── tests/                  #   one spec per API (health/users/orders/cors)
│   └── utils/token.ts          #   mints mock JWTs for protected endpoints
└── src/
    ├── config.ts               # Loads all settings from .env
    ├── types.ts                # Typed subset of the MockServer API
    ├── mockserver.ts           # Start/stop server (incl. CORS jvmOptions) + client
    ├── index.ts                # Entry point: load contracts → start → register
    ├── stop.ts                 # Standalone "stop the server" helper
    ├── auth/
    │   ├── jwt.ts              # Sign/verify tokens + RBAC checks
    │   └── token-cli.ts        # `npm run token` — mint tokens
    └── contracts/
        ├── schema.ts           # YAML contract types + validation
        ├── loader.ts           # Read + parse + validate YAML files
        ├── convert.ts          # YAML → MockServer expectation/response
        └── register.ts         # Reset + register (static + JWT callbacks)
```

## Install & run

```bash
npm install
cp .env.example .env   # adjust if needed
npm start              # http://localhost:1080
```

On startup it loads every YAML file, validates them, resets the server, and
registers all expectations. Stop with `Ctrl+C` (or `npm run stop` elsewhere).

| Script              | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `npm start`         | Run the server with `ts-node`.                       |
| `npm run build`     | Compile TypeScript to `dist/`.                       |
| `npm run serve`     | Run the compiled output.                             |
| `npm run stop`      | Stop a running server on the configured port.        |
| `npm run token`     | Mint a JWT (see JWT/RBAC below).                      |
| `npm run typecheck` | Type-check without emitting files.                   |
| `npm run test:it`   | Run the Playwright integration tests (see below).    |
| `npm run test:it:ui`| Run the integration tests in Playwright's UI mode.   |
| `npm run test:it:report` | Open the last HTML test report.                 |

## Defining contracts (YAML)

Add a file under `expectations/` per API. Each file lists all the response
cases for that API. Minimal example:

```yaml
service: health            # logical API name (required)
expectations:
  - description: Success
    priority: 10           # higher = matched first (default 0)
    request:
      method: GET
      path: /health        # NOTE: path is matched as a regex by MockServer
    response:
      status: 200
      json:                # serialized to JSON; sets a JSON content-type
        status: UP
```

**Request matching fields** (any omitted field matches anything):

| Field         | Meaning                                                        |
| ------------- | ------------------------------------------------------------- |
| `method`      | HTTP method.                                                   |
| `path`        | Path — **matched as a regular expression**.                   |
| `query`       | Map of query param → value(s). Values are regex-capable.      |
| `headers`     | Map of header → value(s). Values are regex-capable.           |
| `body`        | Match body as JSON (only the given fields must be present).    |
| `bodyRegex`   | Match the raw body string against a regex.                    |
| `bodyText`    | Match the body against an exact string.                       |
| `bodySchema`  | Match the body against a JSON schema.                         |

**Response fields:** `status` (required), `headers`, `json` **or** `text`, and
optional `delayMs`.

### Loading is idempotent on redeploy

Every `npm start` calls `reset()` on MockServer and re-registers everything from
YAML. Restarting the runner always converges to the exact current contract set —
no stale expectations. If any YAML file is invalid, startup fails fast (before
the server takes traffic) with the offending file and reason.

> **Readiness:** MockServer starts accepting connections a moment *before* all
> expectations finish registering. Treat the mock as ready only once the runner
> logs `MockServer is running.` (printed after registration completes). In a
> deploy/health-check, wait for that line — or poll a known mocked endpoint —
> rather than just checking that the port is open.

## Regex matching

- **Path** is always a regex: `path: /users/[0-9]+` matches `/users/123`.
- **Query / header** values are matched as string-or-regex by MockServer, so
  `query: { q: "^foo.*" }` works.
- **Body** regex via `bodyRegex` (matches the raw body string — send compact
  JSON, since `.` does not match newlines):

```yaml
- description: Create user with a valid email
  request:
    method: POST
    path: /users
    bodyRegex: '.*"email"\s*:\s*".+@.+\..+".*'
  response:
    status: 201
    json: { id: "2", status: created }
```

## CORS

CORS is enabled for all responses via MockServer JVM options (configured from
`.env`):

```
CORS_ENABLED=true
CORS_ALLOW_ORIGIN=http://localhost:3000
CORS_ALLOW_METHODS=CONNECT, DELETE, GET, HEAD, OPTIONS, POST, PUT, PATCH, TRACE
CORS_ALLOW_HEADERS=Allow, Content-Encoding, ... , Authorization
CORS_ALLOW_CREDENTIALS=true
CORS_MAX_AGE_SECONDS=300
```

This maps to the documented options:

```js
mockserver.start_mockserver({
  serverPort: 1080,
  jvmOptions: [
    '-Dmockserver.enableCORSForAllResponses=true',
    '-Dmockserver.corsAllowOrigin=http://localhost:3000',
    '-Dmockserver.corsAllowMethods=...',
    '-Dmockserver.corsAllowHeaders=...',
    '-Dmockserver.corsAllowCredentials=true',
    '-Dmockserver.corsMaxAgeInSeconds=300',
  ],
});
```

> **Why a specific origin instead of `*`?** With `corsAllowCredentials=true`,
> the CORS spec forbids the wildcard origin. So we pin `CORS_ALLOW_ORIGIN` to the
> caller's origin (e.g. your local frontend `http://localhost:3000`). MockServer
> reflects that origin on responses and answers `OPTIONS` preflight requests
> automatically.

Verify a preflight:

```bash
curl -i -X OPTIONS \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: GET' \
  http://localhost:1080/orders
# -> 200 with Access-Control-Allow-Origin: http://localhost:3000
#         Access-Control-Allow-Credentials: true
```

## JWT authentication & RBAC

Protected endpoints require a valid **JWT** (HS256, signed with `JWT_SECRET`).
RBAC is expressed in the contract: which **services** may call, and which
**roles** are needed.

### How auth is declared

```yaml
service: orders
defaultAuth:               # applies to every endpoint in this file
  required: true
  services: [orders, admin]   # token.service must be one of these
expectations:
  - description: List orders
    request: { method: GET, path: /orders }
    auth:                  # per-endpoint override / narrowing
      roles: [orders:read, admin]   # token must hold one of these roles
    response: { status: 200, json: [...] }
```

Resolution order for each request to a protected endpoint:

1. **No / malformed / invalid / expired token** → `401 Unauthorized`
2. **Valid token, but `service` not allowed** → `403 Forbidden`
3. **Valid token, but missing required role** → `403 Forbidden`
4. Otherwise → the configured response

Enforcement runs **in this Node process** (via a MockServer object callback) so
the JWT can actually be decoded and its claims checked. (This means protected
endpoints are served while the runner process is up — which it always is, since
it is the thing that runs the mock.)

### Choosing a JWT / granting access to a caller

Mint tokens with the CLI — this is how you "choose the JWT" for a given caller
and grant it specific access:

```bash
# A caller in the "orders" service that may read orders:
npm run token -- --service orders --roles orders:read

# A caller that may read and write:
npm run token -- --service orders --roles orders:read,orders:write

# A privileged caller:
npm run token -- --service admin --roles admin

# Options: --service <name> --roles a,b,c --sub <subject> --expiresIn 30m
```

The command prints the token, its decoded payload, and a ready-to-use `curl`.
Then call a protected endpoint:

```bash
TOKEN=$(npm run token -- --service orders --roles orders:read --silent | grep '^eyJ')
curl -H "Authorization: Bearer $TOKEN" http://localhost:1080/orders   # 200
curl http://localhost:1080/orders                                      # 401
```

### RBAC model: per-service + per-role

- **Per service** (`services:` on the file or endpoint): gate which calling
  service identities may use the API at all — e.g. only `orders` and `admin`
  services can touch the orders API.
- **Per role** (`roles:` on the endpoint): gate individual operations — e.g.
  `orders:read` for `GET`, `orders:write` for `POST`.

To add a new caller, mint a token with the appropriate `--service` and
`--roles`. To grant a service access to a new API, add its name to that
contract's `services` (and the needed roles per endpoint).

## Demo endpoints (shipped)

| Endpoint                                   | Auth          | Shows                      |
| ------------------------------------------ | ------------- | -------------------------- |
| `GET /health[?scenario=client-error\|server-error]` | public | 200 / 4xx / 5xx by priority |
| `GET /users/{n}` / `POST /users`           | public        | regex path & body matching |
| `GET /orders` / `POST /orders`             | JWT + RBAC    | 401 / 403 / 200 / 201      |

### Dashboard

```
# Local
http://localhost:1080/mockserver/dashboard

# Live (Render)
https://mock-server-y8ct.onrender.com/mockserver/dashboard
```

The dashboard logs every incoming request/response in real time. Fire the curl
commands from the [Live demo](#live-demo) section above, then refresh to see
them. Remember the **≥ 50s cold-start** delay on the first request after idle.

## Integration tests (it-test)

[`it-test/`](it-test/) holds end-to-end Playwright tests that exercise every
shipped contract over real HTTP. They use Playwright's
[`webServer`](it-test/playwright.config.ts) block, so the suite is
self-contained: it runs `npm start` (the actual mock server), waits for
`/health` to answer, runs the specs against it, then tears the server down.

```bash
npm install            # one-time: pulls in @playwright/test
npm run test:it        # boots the server + runs all specs
npm run test:it:ui     # same, in Playwright's interactive UI
```

You do **not** need to start the server yourself. If one is already running on
the configured port, the tests reuse it locally (`reuseExistingServer`); in CI
(`CI=1`) they always boot a fresh one. The server URL follows the same env vars
as the app — `$PORT` / `MOCK_SERVER_PORT` (default `1080`) and
`MOCK_SERVER_HOST`.

### What's covered

| Spec                                       | Endpoint(s)                              | Asserts                                              |
| ------------------------------------------ | ---------------------------------------- | --------------------------------------------------- |
| [`health.spec.ts`](it-test/tests/health.spec.ts) | `GET /health` (+ `?scenario=…`)    | 200 UP with the 5 CSV dependencies, plus 400 / 500 cases |
| [`users.spec.ts`](it-test/tests/users.spec.ts)   | `GET /users`, `GET /users/{n}`, `POST /users` | 10-row CSV list, regex path, regex-body 201 vs 422 |
| [`orders.spec.ts`](it-test/tests/orders.spec.ts) | `GET /orders`, `POST /orders`      | JWT-token requests → 200 list (nested customer) / 201 created |
| [`cors.spec.ts`](it-test/tests/cors.spec.ts)     | `OPTIONS` preflight, `GET /health` | the configured CORS headers are returned            |

Tokens for the protected Orders API are minted in-test by
[`utils/token.ts`](it-test/utils/token.ts), which mirrors
[`src/auth/jwt.ts`](src/auth/jwt.ts) (same HS256 secret + issuer) — the
equivalent of `npm run token -- --service orders --roles orders:read`.

> **Note:** RBAC is declared in `orders.yaml` but the current runner
> ([`register.ts`](src/contracts/register.ts)) registers the static matchers
> without enforcing the JWT/RBAC checks, so unauthenticated requests still
> succeed today. `orders.spec.ts` pins this real behaviour; flip those
> expectations to `401` / `403` once enforcement is wired in.

## Adding more APIs

1. Create `expectations/<api>.yaml` with a `service` and `expectations` list.
2. (Optional) add `defaultAuth` / per-endpoint `auth` for JWT + RBAC.
3. Restart the server — it reloads and registers everything.

## Notes

- This iteration covers **HTTP** request mocking. HTTPS and proxy/forwarding
  modes are supported by MockServer and can be layered on later.
- `MOCK_SERVER_VERSION` pins the MockServer (netty jar) version; `6.1.0` is the
  latest release and is downloaded from Maven Central on first run. Keep this in
  sync everywhere — mixing versions leaves orphaned jars that break startup.
