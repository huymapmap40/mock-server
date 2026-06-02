import { CorsConfig } from '../configuration/config';
import { mockServerClient, MockServerClient } from 'mockserver-client';

// `mockserver-node` does not ship TypeScript types; require() it directly.
/* eslint-disable @typescript-eslint/no-var-requires */
const mockServerNode = require('mockserver-node');
/* eslint-enable @typescript-eslint/no-var-requires */

export interface StartOptions {
  serverPort: number;
  verbose?: boolean;
  trace?: boolean;
  mockServerVersion?: string;
  cors?: CorsConfig;
  jvmOptions?: string[]
}

/**
 * Build the JVM system properties that enable CORS for every response.
 *
 * Note: when credentials are allowed the CORS spec forbids a "*" origin, so we
 * pin `corsAllowOrigin` to a specific origin (e.g. http://localhost:3000).
 * MockServer then reflects that origin on responses and answers OPTIONS
 * preflight requests automatically.
 */
function corsJvmOptions(cors: CorsConfig): string[] {
  if (!cors.enabled) {
    return [];
  }
  return [
    '-Dmockserver.enableCORSForAllResponses=true',
    `-Dmockserver.corsAllowOrigin=${cors.allowOrigin}`,
    `-Dmockserver.corsAllowMethods=${cors.allowMethods}`,
    `-Dmockserver.corsAllowHeaders=${cors.allowHeaders}`,
    `-Dmockserver.corsAllowCredentials=${cors.allowCredentials}`,
    `-Dmockserver.corsMaxAgeInSeconds=${cors.maxAgeSeconds}`,
    // '-Dmockserver.disableLogging=true'
  ];
}

/**
 * Download (first run only) and start the MockServer Netty process.
 * Resolves once the server is accepting connections.
 *
 * Note: MockServer runs on the JVM, so a Java runtime (8+) must be installed.
 */
export function startMockServer(options: StartOptions): Promise<void> {
  const startOptions: Record<string, unknown> = {
    serverPort: options.serverPort,
    verbose: options.verbose,
    trace: options.trace,
  };
  if (options.mockServerVersion) {
    startOptions.mockServerVersion = options.mockServerVersion;
  }
  if (options.cors) {
    const jvmOptions = corsJvmOptions(options.cors);
    if (jvmOptions.length > 0) {
      startOptions.jvmOptions = jvmOptions;
    }
  }


  // start_mockserver returns a Q promise which is thenable; wrap it so callers
  // always receive a native Promise<void>.3
  return Promise.resolve(mockServerNode.start_mockserver(startOptions)).then(() => undefined);
}

/** Stop the MockServer process listening on the given port. */
export function stopMockServer(serverPort: number): Promise<void> {
  return Promise.resolve(mockServerNode.stop_mockserver({ serverPort })).then(() => undefined);
}

/** Create a client used to register expectations against a running server. */
export function createClient(host: string, port: number): MockServerClient {
  return mockServerClient(host, port) as MockServerClient;
}

export function getLogMessage(client: MockServerClient){
  return client.retrieveLogMessages({})
}
