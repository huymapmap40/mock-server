import * as winston from 'winston';
import DatadogWinston from 'datadog-winston';
import { DatadogConfig } from '../configuration/config';

let logger: winston.Logger | null = null;

/**
 * Map a Datadog site (e.g. "us5.datadoghq.com") to the intakeRegion value
 * datadog-winston understands. Returns undefined for US1 (datadoghq.com),
 * which is the library's default intake.
 */
function intakeRegionFromSite(site: string): string | undefined {
  if (site.endsWith('.eu')) return 'eu';
  if (site.startsWith('us3.')) return 'us3';
  if (site.startsWith('us5.')) return 'us5';
  return undefined;
}

/**
 * Call once at startup. After this every log() / error() / warn() call
 * is shipped to both the local console and Datadog (when enabled).
 */
export function initLogger(datadog: DatadogConfig): void {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `[${timestamp}] ${level}: ${message}${extra}`;
        }),
      ),
    }),
  ];

  if (datadog.enabled && datadog.apiKey) {
    transports.push(
      new DatadogWinston({
        apiKey: datadog.apiKey,
        hostname: require('os').hostname(),
        service: datadog.service,
        ddsource: 'nodejs',
        ddtags: `env:${datadog.env}`,
        // datadog-winston only recognises 'eu' | 'us3' | 'us5'; anything else
        // (incl. undefined) falls back to the US1 intake. Map our DD_SITE to
        // the matching region so logs reach the right org's intake.
        intakeRegion: intakeRegionFromSite(datadog.site),
      }),
    );
  }

  logger = winston.createLogger({
    level: 'info',
    transports,
  });
}

function getLogger(): winston.Logger {
  if (!logger) {
    throw new Error('Logger not initialized — call initLogger() first');
  }
  return logger;
}

export const log = {
  info: (message: string, meta?: Record<string, unknown>) => getLogger().info(message, meta ?? {}),
  warn: (message: string, meta?: Record<string, unknown>) => getLogger().warn(message, meta ?? {}),
  error: (message: string, meta?: Record<string, unknown>) => getLogger().error(message, meta ?? {}),
};
