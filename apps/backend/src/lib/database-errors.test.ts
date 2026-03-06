import { describe, expect, it } from 'vitest';
import {
  CheckViolationError,
  CONSTRAINTS,
  createDatabaseError,
  DatabaseError,
  ForeignKeyViolationError,
  getConstraintName,
  isCheckViolation,
  isConstraintViolation,
  isForeignKeyViolation,
  isNotNullViolation,
  isPostgresError,
  isUniqueViolation,
  NotNullViolationError,
  type PostgresError,
  PostgresErrorCode,
  UniqueConstraintError,
} from './database-errors.js';

describe('database-errors', () => {
  describe('PostgresError detection', () => {
    it('should identify direct PostgreSQL error', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'duplicate key value',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: 'users_email_unique',
      };

      expect(isPostgresError(error)).toBe(true);
    });

    it('should identify PostgreSQL error in cause chain', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'unique constraint violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE,
      };

      const wrappedError = new Error('Database operation failed');
      Object.assign(wrappedError, { cause: pgError });

      expect(isPostgresError(wrappedError)).toBe(true);
    });

    it('should identify PostgreSQL error in deeply nested cause chain', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'check constraint violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_STATUS_CHECK,
      };

      const level1 = new Error('Level 1');
      const level2 = new Error('Level 2');
      const level3 = new Error('Level 3');

      Object.assign(level2, { cause: level3 });
      Object.assign(level1, { cause: level2 });
      Object.assign(level3, { cause: pgError });

      expect(isPostgresError(level1)).toBe(true);
    });

    it('should return false for non-PostgreSQL errors', () => {
      const error = new Error('Regular error');

      expect(isPostgresError(error)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isPostgresError(null)).toBe(false);
      expect(isPostgresError(undefined)).toBe(false);
    });

    it('should handle errors without code property', () => {
      const error = { message: 'Some error', name: 'Error' };

      expect(isPostgresError(error)).toBe(false);
    });

    it('should prevent infinite recursion with circular cause chains', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      // Create circular reference
      Object.assign(error1, { cause: error2 });
      Object.assign(error2, { cause: error1 });

      expect(isPostgresError(error1)).toBe(false);
    });
  });

  describe('Foreign key violation detection', () => {
    it('should identify foreign key violation', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'insert or update violates foreign key constraint',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: 'some_fk_constraint',
        detail: 'Key (company_id)=(invalid-uuid) is not present in table "companies".',
      };

      expect(isForeignKeyViolation(error)).toBe(true);
    });

    it('should identify FK violation in wrapped error', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'foreign key violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: 'some_fk_constraint',
      };

      const drizzleError = new Error('Failed to insert');
      Object.assign(drizzleError, { cause: pgError });

      expect(isForeignKeyViolation(drizzleError)).toBe(true);
    });

    it('should return false for non-FK violations', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'unique violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE,
      };

      expect(isForeignKeyViolation(error)).toBe(false);
    });
  });

  describe('Unique violation detection', () => {
    it('should identify unique constraint violation', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'duplicate key value violates unique constraint',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE,
      };

      expect(isUniqueViolation(error)).toBe(true);
    });

    it('should return false for non-unique violations', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'check violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_STATUS_CHECK,
      };

      expect(isUniqueViolation(error)).toBe(false);
    });
  });

  describe('Not null violation detection', () => {
    it('should identify not null violation', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'null value in column violates not-null constraint',
        code: PostgresErrorCode.NOT_NULL_VIOLATION,
        column_name: 'title',
        table_name: 'jobs',
      };

      expect(isNotNullViolation(error)).toBe(true);
    });

    it('should return false for non-not-null violations', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'check violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_STATUS_CHECK,
      };

      expect(isNotNullViolation(error)).toBe(false);
    });
  });

  describe('Check violation detection', () => {
    it('should identify check constraint violation', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'new row violates check constraint',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_STATUS_CHECK,
      };

      expect(isCheckViolation(error)).toBe(true);
    });

    it('should return false for non-check violations', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'unique violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE,
      };

      expect(isCheckViolation(error)).toBe(false);
    });
  });

  describe('Constraint name extraction', () => {
    it('should extract constraint name from direct error', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'constraint violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE,
      };

      expect(getConstraintName(error)).toBe(CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE);
    });

    it('should extract constraint name from wrapped error', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'check violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_STATUS_CHECK,
      };

      const wrappedError = new Error('Database error');
      Object.assign(wrappedError, { cause: pgError });

      expect(getConstraintName(wrappedError)).toBe(CONSTRAINTS.ORDERS_STATUS_CHECK);
    });

    it('should return undefined for errors without constraint name', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'some error',
        code: '42000',
      };

      expect(getConstraintName(error)).toBeUndefined();
    });

    it('should return undefined for non-PostgreSQL errors', () => {
      const error = new Error('Regular error');

      expect(getConstraintName(error)).toBeUndefined();
    });
  });

  describe('Constraint violation checking', () => {
    it('should match specific constraint', () => {
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'unique violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE,
      };

      expect(isConstraintViolation(error, CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE)).toBe(true);
      expect(isConstraintViolation(error, CONSTRAINTS.ORDERS_STATUS_CHECK)).toBe(false);
    });

    it('should work with wrapped errors', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'check violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_STATUS_CHECK,
      };

      const wrappedError = new Error('Database error');
      Object.assign(wrappedError, { cause: pgError });

      expect(isConstraintViolation(wrappedError, CONSTRAINTS.ORDERS_STATUS_CHECK)).toBe(true);
    });
  });

  describe('DatabaseError class', () => {
    it('should create DatabaseError with proper properties', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'database error',
        code: '42000',
        detail: 'Some detail',
        constraint_name: 'some_constraint',
        table_name: 'jobs',
        column_name: 'status',
      };

      const error = new DatabaseError('Test error', pgError);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.name).toBe('DatabaseError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('42000');
      expect(error.detail).toBe('Some detail');
      expect(error.constraint).toBe('some_constraint');
      expect(error.table).toBe('jobs');
      expect(error.column).toBe('status');
    });

    it('should handle PostgreSQL error without optional properties', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'minimal error',
        code: '42000',
      };

      const error = new DatabaseError('Minimal error', pgError);

      expect(error.code).toBe('42000');
      expect(error.detail).toBeUndefined();
      expect(error.constraint).toBeUndefined();
      expect(error.table).toBeUndefined();
      expect(error.column).toBeUndefined();
    });
  });

  describe('ForeignKeyViolationError class', () => {
    it('should create ForeignKeyViolationError with proper message', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'FK violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: 'test_fk_constraint',
        detail: 'Key not found',
      };

      const error = new ForeignKeyViolationError(pgError);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(ForeignKeyViolationError);
      expect(error.name).toBe('ForeignKeyViolationError');
      expect(error.message).toContain('test_fk_constraint');
      expect(error.constraint).toBe('test_fk_constraint');
    });

    it('should handle missing constraint name', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'FK violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
      };

      const error = new ForeignKeyViolationError(pgError);

      expect(error.message).toContain('unknown');
    });
  });

  describe('UniqueConstraintError class', () => {
    it('should create UniqueConstraintError with proper message', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'unique violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE,
      };

      const error = new UniqueConstraintError(pgError);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(UniqueConstraintError);
      expect(error.name).toBe('UniqueConstraintError');
      expect(error.message).toContain(CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE);
    });
  });

  describe('NotNullViolationError class', () => {
    it('should create NotNullViolationError with column name', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'null value',
        code: PostgresErrorCode.NOT_NULL_VIOLATION,
        column_name: 'title',
        table_name: 'jobs',
      };

      const error = new NotNullViolationError(pgError);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(NotNullViolationError);
      expect(error.name).toBe('NotNullViolationError');
      expect(error.message).toContain('title');
      expect(error.column).toBe('title');
    });

    it('should handle missing column name', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'null value',
        code: PostgresErrorCode.NOT_NULL_VIOLATION,
      };

      const error = new NotNullViolationError(pgError);

      expect(error.message).toContain('unknown');
    });
  });

  describe('CheckViolationError class', () => {
    it('should create CheckViolationError with constraint name', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'check violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_STATUS_CHECK,
      };

      const error = new CheckViolationError(pgError);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(CheckViolationError);
      expect(error.name).toBe('CheckViolationError');
      expect(error.message).toContain(CONSTRAINTS.ORDERS_STATUS_CHECK);
    });
  });

  describe('createDatabaseError', () => {
    it('should create ForeignKeyViolationError for FK violations', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'FK violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: 'test_fk_constraint',
      };

      const error = createDatabaseError(pgError);

      expect(error).toBeInstanceOf(ForeignKeyViolationError);
      expect(error?.name).toBe('ForeignKeyViolationError');
    });

    it('should create UniqueConstraintError for unique violations', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'unique violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE,
      };

      const error = createDatabaseError(pgError);

      expect(error).toBeInstanceOf(UniqueConstraintError);
      expect(error?.name).toBe('UniqueConstraintError');
    });

    it('should create NotNullViolationError for not null violations', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'null value',
        code: PostgresErrorCode.NOT_NULL_VIOLATION,
        column_name: 'title',
      };

      const error = createDatabaseError(pgError);

      expect(error).toBeInstanceOf(NotNullViolationError);
      expect(error?.name).toBe('NotNullViolationError');
    });

    it('should create CheckViolationError for check violations', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'check violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.ORDERS_STATUS_CHECK,
      };

      const error = createDatabaseError(pgError);

      expect(error).toBeInstanceOf(CheckViolationError);
      expect(error?.name).toBe('CheckViolationError');
    });

    it('should create generic DatabaseError for unknown codes', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'some error',
        code: '42000',
      };

      const error = createDatabaseError(pgError);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).not.toBeInstanceOf(ForeignKeyViolationError);
      expect(error).not.toBeInstanceOf(UniqueConstraintError);
    });

    it('should handle wrapped errors', () => {
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'FK violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: 'test_fk_constraint',
      };

      const wrappedError = new Error('Drizzle error');
      Object.assign(wrappedError, { cause: pgError });

      const error = createDatabaseError(wrappedError);

      expect(error).toBeInstanceOf(ForeignKeyViolationError);
    });

    it('should return null for non-PostgreSQL errors', () => {
      const error = new Error('Regular error');

      const result = createDatabaseError(error);

      expect(result).toBeNull();
    });

    it('should return null for null or undefined', () => {
      expect(createDatabaseError(null)).toBeNull();
      expect(createDatabaseError(undefined)).toBeNull();
    });
  });

  describe('CONSTRAINTS constants', () => {
    it('should have all expected constraint names', () => {
      expect(CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE).toBe('idx_orders_order_number');
      expect(CONSTRAINTS.ORDERS_STATUS_CHECK).toBe('orders_status_check');
    });
  });
});
