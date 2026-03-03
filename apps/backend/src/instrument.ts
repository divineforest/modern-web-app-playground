import * as Sentry from '@sentry/node';

const environment = process.env['NODE_ENV'] || 'development';

Sentry.init({
  dsn: 'https://2894e7ca45dd299883b6d23b275522c2@o4506954185375744.ingest.us.sentry.io/4509955827433472',
  // Only enable Sentry in production and staging environments
  enabled: ['production', 'staging'].includes(environment),
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  environment: environment,
  // Enable Sentry Logs to capture and forward Pino logs
  enableLogs: true,
  // Enable distributed tracing with 100% sampling rate
  tracesSampleRate: 1.0,
  integrations: [
    // Forward Pino logs (info, warn, error, fatal) to Sentry Logs
    // PII is redacted by Pino before Sentry captures the logs
    // Note: pinoIntegration auto-instruments Pino - no logger instance needed
    Sentry.pinoIntegration({
      log: { levels: ['info', 'warn', 'error', 'fatal'] },
    }),
  ],
});
