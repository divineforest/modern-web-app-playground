import pino from 'pino';
import { env } from './env.js';

// Logger configuration based on environment
const isDevelopment = env.NODE_ENV !== 'production';

/**
 * PII redaction paths - commonly sensitive fields.
 * Used internally by the module logger configuration.
 */
const piiRedactionPaths = [
  'password',
  'pass',
  'passwd',
  'secret',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'auth',
  'apiKey',
  'api_key',
  'key',
  'privateKey',
  'private_key',
  'publicKey',
  'public_key',
  'email',
  'emailAddress',
  'email_address',
  'phone',
  'phoneNumber',
  'phone_number',
  'ssn',
  'socialSecurityNumber',
  'social_security_number',
  'vatId',
  'vat_id',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'address',
  'streetAddress',
  'street_address',
  'postalCode',
  'postal_code',
  'zipCode',
  'zip_code',
  'name',
  'firstName',
  'first_name',
  'lastName',
  'last_name',
  'fullName',
  'full_name',
  'ip',
  'ipAddress',
  'ip_address',
  'userAgent',
  'user_agent',
  // Request/response body fields
  'req.body.password',
  'req.body.email',
  'req.body.token',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers.setCookie',
  // Nested object patterns
  'user.password',
  'user.email',
  'user.phone',
  'credentials.*',
  'auth.*',
  'session.*',
];

export const baseLoggerConfig = {
  level: env.LOG_LEVEL,
  redact: {
    paths: piiRedactionPaths,
    censor: '[REDACTED]',
    remove: false,
  },
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const developmentConfig = {
  ...baseLoggerConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  },
};

export const logger = pino(isDevelopment ? developmentConfig : baseLoggerConfig);

// Create child loggers for different modules
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};
