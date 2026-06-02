import { config, baseUrl } from '../configuration/config';
import { startMockServer, stopMockServer, createClient, getLogMessage } from './mockserver';
import { loadContracts } from '../contracts/loader';
import { registerContracts } from '../contracts/register';
import { initLogger, log } from '../helpers/logger';
import { registerObservedEndpoint } from '../observed-endpoint';

async function main(): Promise<void> {
  // Load + validate all YAML contracts before touching the server, so a broken
  // contract fails the deploy before the server starts accepting traffic.
  const contracts = loadContracts(config.contractsDir);

  console.log(`Starting MockServer on port ${config.port} ...`);
  await startMockServer({
    serverPort: config.port,
    verbose: config.verbose,
    trace: config.trace,
    mockServerVersion: config.mockServerVersion,
    cors: config.cors,
  });
  console.log(`MockServer is up at ${baseUrl}`);

  const client = createClient(config.host, config.port);

  initLogger(config.datadog);
  
  const summary = await registerContracts(client, contracts);

  // Demo: a websocket request-callback endpoint that forwards a log per request.
  await registerObservedEndpoint(client);

  log.info(
    `\nRegistered ${summary.total} expectation(s) from ${summary.files} contract file(s) ` +
      `(${summary.authProtected} JWT/RBAC-protected):`,
  );
  for (const contract of contracts) {
    log.info(`  - ${contract.sourceFile} [${contract.service}]: ${contract.expectations.length} case(s)`);
  }
  if (config.cors.enabled) {
    log.info(`\nCORS enabled for origin: ${config.cors.allowOrigin} (credentials: ${config.cors.allowCredentials})`);
  }
  log.info(`\nDashboard: ${baseUrl}/mockserver/dashboard`);
  log.info('\nMockServer is running. Press Ctrl+C to stop.');

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`\nReceived ${signal}, stopping MockServer ...`);
    try {
      await stopMockServer(config.port);
      console.log('MockServer stopped.');
      process.exit(0);
    } catch (error) {
      console.error('Error while stopping MockServer:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Failed to start MockServer:', error);
  process.exit(1);
});
