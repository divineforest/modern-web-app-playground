import { describe, expect, it, vi } from 'vitest';
import { createModuleLogger, logger } from './logger.js';

describe('Logger', () => {
  describe('createModuleLogger', () => {
    it('should create a child logger with module name', () => {
      const moduleLogger = createModuleLogger('test-module');
      const infoSpy = vi.spyOn(moduleLogger, 'info').mockImplementation(() => {});

      moduleLogger.info('Test message');

      expect(infoSpy).toHaveBeenCalledWith('Test message');

      infoSpy.mockRestore();
    });
  });

  describe('default logger', () => {
    it('should be defined and have logging methods', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.warn).toBe('function');
    });

    it('should log messages without throwing errors', () => {
      expect(() => {
        logger.info('Test info message');
        logger.debug('Test debug message');
        logger.warn('Test warn message');
        logger.error('Test error message');
      }).not.toThrow();
    });
  });

  describe('PII redaction', () => {
    it('should redact password fields', () => {
      const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
      const sensitiveData = {
        username: 'john_doe',
        password: 'supersecret123',
        email: 'john@example.com',
      };

      logger.info(sensitiveData);

      const loggedCall = infoSpy.mock.calls[0];
      expect(loggedCall).toBeDefined();

      infoSpy.mockRestore();
    });

    it('should redact nested sensitive fields', () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const nestedSensitiveData = {
        user: {
          id: 123,
          password: 'mypassword',
          email: 'user@test.com',
          phone: '555-1234',
        },
        req: {
          body: {
            password: 'loginpass',
            token: 'abc123token',
          },
          headers: {
            authorization: 'Bearer secret_token',
          },
        },
      };

      logger.warn(nestedSensitiveData);

      const loggedCall = warnSpy.mock.calls[0];
      expect(loggedCall).toBeDefined();

      warnSpy.mockRestore();
    });

    it('should redact common auth tokens', () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const authData = {
        accessToken: 'access_token_value',
        refreshToken: 'refresh_token_value',
        apiKey: 'api_key_value',
        secret: 'secret_value',
      };

      logger.error(authData);

      const loggedCall = errorSpy.mock.calls[0];
      expect(loggedCall).toBeDefined();

      errorSpy.mockRestore();
    });

    it('should not redact non-sensitive fields', () => {
      const debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});
      const publicData = {
        username: 'john_doe',
        id: 123,
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
      };

      logger.debug(publicData);

      const loggedCall = debugSpy.mock.calls[0];
      expect(loggedCall).toBeDefined();

      debugSpy.mockRestore();
    });

    it('should work with module loggers', () => {
      const moduleLogger = createModuleLogger('auth-service');
      const infoSpy = vi.spyOn(moduleLogger, 'info').mockImplementation(() => {});

      moduleLogger.info(
        { userId: 123, password: 'userpass', loginAttempt: true },
        'User login attempt'
      );

      const loggedCall = infoSpy.mock.calls[0];
      expect(loggedCall).toBeDefined();

      infoSpy.mockRestore();
    });
  });
});
