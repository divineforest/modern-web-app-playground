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
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'duplicate key value',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: 'users_email_unique',
      };

      // ACT & ASSERT
      expect(isPostgresError(error)).toBe(true);
    });

    it('should identify PostgreSQL error in cause chain', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'foreign key violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_COMPANY_FK,
      };

      const wrappedError = new Error('Database operation failed');
      Object.assign(wrappedError, { cause: pgError });

      // ACT & ASSERT
      expect(isPostgresError(wrappedError)).toBe(true);
    });

    it('should identify PostgreSQL error in deeply nested cause chain', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'check constraint violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_STATUS_CHECK,
      };

      const level1 = new Error('Level 1');
      const level2 = new Error('Level 2');
      const level3 = new Error('Level 3');

      Object.assign(level2, { cause: level3 });
      Object.assign(level1, { cause: level2 });
      Object.assign(level3, { cause: pgError });

      // ACT & ASSERT
      expect(isPostgresError(level1)).toBe(true);
    });

    it('should return false for non-PostgreSQL errors', () => {
      // ARRANGE
      const error = new Error('Regular error');

      // ACT & ASSERT
      expect(isPostgresError(error)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      // ACT & ASSERT
      expect(isPostgresError(null)).toBe(false);
      expect(isPostgresError(undefined)).toBe(false);
    });

    it('should handle errors without code property', () => {
      // ARRANGE
      const error = { message: 'Some error', name: 'Error' };

      // ACT & ASSERT
      expect(isPostgresError(error)).toBe(false);
    });

    it('should prevent infinite recursion with circular cause chains', () => {
      // ARRANGE
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      // Create circular reference
      Object.assign(error1, { cause: error2 });
      Object.assign(error2, { cause: error1 });

      // ACT & ASSERT
      expect(isPostgresError(error1)).toBe(false);
    });
  });

  describe('Foreign key violation detection', () => {
    it('should identify foreign key violation', () => {
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'insert or update violates foreign key constraint',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_COMPANY_FK,
        detail: 'Key (company_id)=(invalid-uuid) is not present in table "companies".',
      };

      // ACT & ASSERT
      expect(isForeignKeyViolation(error)).toBe(true);
    });

    it('should identify FK violation in wrapped error', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'foreign key violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_SERVICE_TYPE_FK,
      };

      const drizzleError = new Error('Failed to insert');
      Object.assign(drizzleError, { cause: pgError });

      // ACT & ASSERT
      expect(isForeignKeyViolation(drizzleError)).toBe(true);
    });

    it('should return false for non-FK violations', () => {
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'unique violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: 'users_email_unique',
      };

      // ACT & ASSERT
      expect(isForeignKeyViolation(error)).toBe(false);
    });
  });

  describe('Unique violation detection', () => {
    it('should identify unique constraint violation', () => {
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'duplicate key value violates unique constraint',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.SERVICE_TYPES_CODE_UNIQUE,
      };

      // ACT & ASSERT
      expect(isUniqueViolation(error)).toBe(true);
    });

    it('should return false for non-unique violations', () => {
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'foreign key violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_COMPANY_FK,
      };

      // ACT & ASSERT
      expect(isUniqueViolation(error)).toBe(false);
    });
  });

  describe('Not null violation detection', () => {
    it('should identify not null violation', () => {
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'null value in column violates not-null constraint',
        code: PostgresErrorCode.NOT_NULL_VIOLATION,
        column_name: 'title',
        table_name: 'jobs',
      };

      // ACT & ASSERT
      expect(isNotNullViolation(error)).toBe(true);
    });

    it('should return false for non-not-null violations', () => {
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'check violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_STATUS_CHECK,
      };

      // ACT & ASSERT
      expect(isNotNullViolation(error)).toBe(false);
    });
  });

  describe('Check violation detection', () => {
    it('should identify check constraint violation', () => {
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'new row violates check constraint',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_STATUS_CHECK,
      };

      // ACT & ASSERT
      expect(isCheckViolation(error)).toBe(true);
    });

    it('should return false for non-check violations', () => {
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'unique violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.SERVICE_TYPES_CODE_UNIQUE,
      };

      // ACT & ASSERT
      expect(isCheckViolation(error)).toBe(false);
    });
  });

  describe('Constraint name extraction', () => {
    it('should extract constraint name from direct error', () => {
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'constraint violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_COMPANY_FK,
      };

      // ACT & ASSERT
      expect(getConstraintName(error)).toBe(CONSTRAINTS.JOBS_COMPANY_FK);
    });

    it('should extract constraint name from wrapped error', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'unique violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.JOB_TEMPLATES_CODE_UNIQUE,
      };

      const wrappedError = new Error('Database error');
      Object.assign(wrappedError, { cause: pgError });

      // ACT & ASSERT
      expect(getConstraintName(wrappedError)).toBe(CONSTRAINTS.JOB_TEMPLATES_CODE_UNIQUE);
    });

    it('should return undefined for errors without constraint name', () => {
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'some error',
        code: '42000',
      };

      // ACT & ASSERT
      expect(getConstraintName(error)).toBeUndefined();
    });

    it('should return undefined for non-PostgreSQL errors', () => {
      // ARRANGE
      const error = new Error('Regular error');

      // ACT & ASSERT
      expect(getConstraintName(error)).toBeUndefined();
    });
  });

  describe('Constraint violation checking', () => {
    it('should match specific constraint', () => {
      // ARRANGE
      const error: PostgresError = {
        name: 'PostgresError',
        message: 'foreign key violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_COMPANY_FK,
      };

      // ACT & ASSERT
      expect(isConstraintViolation(error, CONSTRAINTS.JOBS_COMPANY_FK)).toBe(true);
      expect(isConstraintViolation(error, CONSTRAINTS.JOBS_SERVICE_TYPE_FK)).toBe(false);
    });

    it('should work with wrapped errors', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'check violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_STATUS_CHECK,
      };

      const wrappedError = new Error('Database error');
      Object.assign(wrappedError, { cause: pgError });

      // ACT & ASSERT
      expect(isConstraintViolation(wrappedError, CONSTRAINTS.JOBS_STATUS_CHECK)).toBe(true);
    });
  });

  describe('DatabaseError class', () => {
    it('should create DatabaseError with proper properties', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'database error',
        code: '42000',
        detail: 'Some detail',
        constraint_name: 'some_constraint',
        table_name: 'jobs',
        column_name: 'status',
      };

      // ACT
      const error = new DatabaseError('Test error', pgError);

      // ASSERT
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
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'minimal error',
        code: '42000',
      };

      // ACT
      const error = new DatabaseError('Minimal error', pgError);

      // ASSERT
      expect(error.code).toBe('42000');
      expect(error.detail).toBeUndefined();
      expect(error.constraint).toBeUndefined();
      expect(error.table).toBeUndefined();
      expect(error.column).toBeUndefined();
    });
  });

  describe('ForeignKeyViolationError class', () => {
    it('should create ForeignKeyViolationError with proper message', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'FK violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_COMPANY_FK,
        detail: 'Key not found',
      };

      // ACT
      const error = new ForeignKeyViolationError(pgError);

      // ASSERT
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(ForeignKeyViolationError);
      expect(error.name).toBe('ForeignKeyViolationError');
      expect(error.message).toContain(CONSTRAINTS.JOBS_COMPANY_FK);
      expect(error.constraint).toBe(CONSTRAINTS.JOBS_COMPANY_FK);
    });

    it('should handle missing constraint name', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'FK violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
      };

      // ACT
      const error = new ForeignKeyViolationError(pgError);

      // ASSERT
      expect(error.message).toContain('unknown');
    });
  });

  describe('UniqueConstraintError class', () => {
    it('should create UniqueConstraintError with proper message', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'unique violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.SERVICE_TYPES_CODE_UNIQUE,
      };

      // ACT
      const error = new UniqueConstraintError(pgError);

      // ASSERT
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(UniqueConstraintError);
      expect(error.name).toBe('UniqueConstraintError');
      expect(error.message).toContain(CONSTRAINTS.SERVICE_TYPES_CODE_UNIQUE);
    });
  });

  describe('NotNullViolationError class', () => {
    it('should create NotNullViolationError with column name', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'null value',
        code: PostgresErrorCode.NOT_NULL_VIOLATION,
        column_name: 'title',
        table_name: 'jobs',
      };

      // ACT
      const error = new NotNullViolationError(pgError);

      // ASSERT
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(NotNullViolationError);
      expect(error.name).toBe('NotNullViolationError');
      expect(error.message).toContain('title');
      expect(error.column).toBe('title');
    });

    it('should handle missing column name', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'null value',
        code: PostgresErrorCode.NOT_NULL_VIOLATION,
      };

      // ACT
      const error = new NotNullViolationError(pgError);

      // ASSERT
      expect(error.message).toContain('unknown');
    });
  });

  describe('CheckViolationError class', () => {
    it('should create CheckViolationError with constraint name', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'check violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_STATUS_CHECK,
      };

      // ACT
      const error = new CheckViolationError(pgError);

      // ASSERT
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(CheckViolationError);
      expect(error.name).toBe('CheckViolationError');
      expect(error.message).toContain(CONSTRAINTS.JOBS_STATUS_CHECK);
    });
  });

  describe('createDatabaseError', () => {
    it('should create ForeignKeyViolationError for FK violations', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'FK violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_COMPANY_FK,
      };

      // ACT
      const error = createDatabaseError(pgError);

      // ASSERT
      expect(error).toBeInstanceOf(ForeignKeyViolationError);
      expect(error?.name).toBe('ForeignKeyViolationError');
    });

    it('should create UniqueConstraintError for unique violations', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'unique violation',
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint_name: CONSTRAINTS.SERVICE_TYPES_CODE_UNIQUE,
      };

      // ACT
      const error = createDatabaseError(pgError);

      // ASSERT
      expect(error).toBeInstanceOf(UniqueConstraintError);
      expect(error?.name).toBe('UniqueConstraintError');
    });

    it('should create NotNullViolationError for not null violations', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'null value',
        code: PostgresErrorCode.NOT_NULL_VIOLATION,
        column_name: 'title',
      };

      // ACT
      const error = createDatabaseError(pgError);

      // ASSERT
      expect(error).toBeInstanceOf(NotNullViolationError);
      expect(error?.name).toBe('NotNullViolationError');
    });

    it('should create CheckViolationError for check violations', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'check violation',
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_STATUS_CHECK,
      };

      // ACT
      const error = createDatabaseError(pgError);

      // ASSERT
      expect(error).toBeInstanceOf(CheckViolationError);
      expect(error?.name).toBe('CheckViolationError');
    });

    it('should create generic DatabaseError for unknown codes', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'some error',
        code: '42000',
      };

      // ACT
      const error = createDatabaseError(pgError);

      // ASSERT
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).not.toBeInstanceOf(ForeignKeyViolationError);
      expect(error).not.toBeInstanceOf(UniqueConstraintError);
    });

    it('should handle wrapped errors', () => {
      // ARRANGE
      const pgError: PostgresError = {
        name: 'PostgresError',
        message: 'FK violation',
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint_name: CONSTRAINTS.JOBS_SERVICE_TYPE_FK,
      };

      const wrappedError = new Error('Drizzle error');
      Object.assign(wrappedError, { cause: pgError });

      // ACT
      const error = createDatabaseError(wrappedError);

      // ASSERT
      expect(error).toBeInstanceOf(ForeignKeyViolationError);
    });

    it('should return null for non-PostgreSQL errors', () => {
      // ARRANGE
      const error = new Error('Regular error');

      // ACT
      const result = createDatabaseError(error);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should return null for null or undefined', () => {
      // ACT & ASSERT
      expect(createDatabaseError(null)).toBeNull();
      expect(createDatabaseError(undefined)).toBeNull();
    });
  });

  describe('CONSTRAINTS constants', () => {
    it('should have all expected constraint names', () => {
      // ACT & ASSERT
      expect(CONSTRAINTS.JOBS_COMPANY_FK).toBe('jobs_company_id_companies_id_fk');
      expect(CONSTRAINTS.JOBS_SERVICE_TYPE_FK).toBe('jobs_service_type_id_service_types_id_fk');
      expect(CONSTRAINTS.JOB_TEMPLATES_SERVICE_TYPE_FK).toBe(
        'job_templates_service_type_id_service_types_id_fk'
      );
      expect(CONSTRAINTS.SERVICE_TYPES_CODE_UNIQUE).toBe('service_types_code_unique');
      expect(CONSTRAINTS.JOB_TEMPLATES_CODE_UNIQUE).toBe('job_templates_code_unique');
      expect(CONSTRAINTS.JOBS_STATUS_CHECK).toBe('jobs_status_check');
      expect(CONSTRAINTS.SERVICE_TYPES_STATUS_CHECK).toBe('service_types_status_check');
      expect(CONSTRAINTS.SERVICE_TYPES_CODE_CHECK).toBe('service_types_code_check');
      expect(CONSTRAINTS.JOB_TEMPLATES_CODE_CHECK).toBe('code_check');
    });
  });
});
