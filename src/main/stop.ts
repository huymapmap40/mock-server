import { config } from '../configuration/config';
import { stopMockServer } from './mockserver';

/**
 * Standalone helper to stop a MockServer instance started in another process
 * (e.g. when it was launched in the background). Usage: `npm run stop`.
 */
stopMockServer(config.port)
  .then(() => {
    console.log(`MockServer on port ${config.port} stopped.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to stop MockServer:', error);
    process.exit(1);
  });
