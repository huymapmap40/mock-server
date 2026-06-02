// Re-export the server-side logger so legacy imports keep working.
// @datadog/browser-logs cannot be used in Node.js — use this module instead.
export { log, initLogger } from './logger';
