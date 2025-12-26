/**
 * PostgreSQL error codes
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PostgresErrorCode = {
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
} as const;

/**
 * Database constraint names
 * Centralized constants for type-safe constraint handling
 */
export const CONSTRAINTS = {
  // Foreign key constraints
  JOBS_COMPANY_FK: 'jobs_company_id_companies_id_fk',
  JOBS_SERVICE_TYPE_FK: 'jobs_service_type_id_service_types_id_fk',
  JOB_TEMPLATES_SERVICE_TYPE_FK: 'job_templates_service_type_id_service_types_id_fk',
  INVOICES_COMPANY_FK: 'invoices_company_id_companies_id_fk',
  INVOICES_CONTACT_FK: 'invoices_contact_id_global_contacts_id_fk',

  // Unique constraints
  SERVICE_TYPES_CODE_UNIQUE: 'service_types_code_unique',
  JOB_TEMPLATES_CODE_UNIQUE: 'job_templates_code_unique',
  INVOICES_COMPANY_INVOICE_NUMBER_UNIQUE: 'idx_invoices_company_invoice_number',

  // Check constraints
  JOBS_STATUS_CHECK: 'jobs_status_check',
  SERVICE_TYPES_STATUS_CHECK: 'service_types_status_check',
  SERVICE_TYPES_CODE_CHECK: 'service_types_code_check',
  JOB_TEMPLATES_CODE_CHECK: 'code_check',
  INVOICES_TYPE_CHECK: 'invoices_type_check',
  INVOICES_STATUS_CHECK: 'invoices_status_check',
} as const;

/**
 * PostgreSQL error structure from postgres.js driver
 * @see https://github.com/porsager/postgres
 */
export interface PostgresError extends Error {
  code: string;
  detail?: string;
  hint?: string;
  position?: string;
  internal_position?: string;
  internal_query?: string;
  where?: string;
  schema_name?: string;
  table_name?: string;
  column_name?: string;
  data_type_name?: string;
  constraint_name?: string;
  file?: string;
  line?: string;
  routine?: string;
  severity?: string;
  severity_local?: string;
}

/**
 * Base database error class
 * Represents errors originating from database operations
 */
export class DatabaseError extends Error {
  public readonly code: string;
  public readonly detail?: string;
  public readonly constraint?: string;
  public readonly table?: string;
  public readonly column?: string;

  constructor(message: string, pgError: PostgresError) {
    super(message);
    this.name = 'DatabaseError';
    this.code = pgError.code;
    if (pgError.detail !== undefined) this.detail = pgError.detail;
    if (pgError.constraint_name !== undefined) this.constraint = pgError.constraint_name;
    if (pgError.table_name !== undefined) this.table = pgError.table_name;
    if (pgError.column_name !== undefined) this.column = pgError.column_name;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Foreign key constraint violation error
 * Thrown when a foreign key constraint is violated
 */
export class ForeignKeyViolationError extends DatabaseError {
  constructor(pgError: PostgresError) {
    const constraint = pgError.constraint_name || 'unknown';
    const message = `Foreign key constraint violation: ${constraint}`;
    super(message, pgError);
    this.name = 'ForeignKeyViolationError';
  }
}

/**
 * Unique constraint violation error
 * Thrown when a unique constraint is violated
 */
export class UniqueConstraintError extends DatabaseError {
  constructor(pgError: PostgresError) {
    const constraint = pgError.constraint_name || 'unknown';
    const message = `Unique constraint violation: ${constraint}`;
    super(message, pgError);
    this.name = 'UniqueConstraintError';
  }
}

/**
 * Not null constraint violation error
 * Thrown when a not null constraint is violated
 */
export class NotNullViolationError extends DatabaseError {
  constructor(pgError: PostgresError) {
    const column = pgError.column_name || 'unknown';
    const message = `Not null constraint violation on column: ${column}`;
    super(message, pgError);
    this.name = 'NotNullViolationError';
  }
}

/**
 * Check constraint violation error
 * Thrown when a check constraint is violated
 */
export class CheckViolationError extends DatabaseError {
  constructor(pgError: PostgresError) {
    const constraint = pgError.constraint_name || 'unknown';
    const message = `Check constraint violation: ${constraint}`;
    super(message, pgError);
    this.name = 'CheckViolationError';
  }
}

/**
 * Maximum depth for cause chain traversal to prevent infinite loops
 */
const MAX_CAUSE_DEPTH = 10;

/**
 * Extract PostgreSQL error from error or its cause chain
 * Drizzle ORM wraps PostgreSQL errors, so we check the cause property
 */
function extractPostgresError(error: unknown, depth = 0): PostgresError | null {
  // Prevent infinite recursion
  if (depth >= MAX_CAUSE_DEPTH) {
    return null;
  }

  // Check if current error is a PostgreSQL error
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as PostgresError).code === 'string'
  ) {
    return error as PostgresError;
  }

  // Check cause chain
  if (error && typeof error === 'object' && 'cause' in error && error.cause) {
    return extractPostgresError(error.cause, depth + 1);
  }

  return null;
}

/**
 * Type guard to check if an error is a PostgreSQL error
 * Checks both direct errors and cause chain
 */
export function isPostgresError(error: unknown): error is PostgresError {
  return extractPostgresError(error) !== null;
}

/**
 * Check if error is a foreign key violation
 */
export function isForeignKeyViolation(error: unknown): boolean {
  const pgError = extractPostgresError(error);
  return pgError?.code === PostgresErrorCode.FOREIGN_KEY_VIOLATION;
}

/**
 * Check if error is a unique constraint violation
 */
export function isUniqueViolation(error: unknown): boolean {
  const pgError = extractPostgresError(error);
  return pgError?.code === PostgresErrorCode.UNIQUE_VIOLATION;
}

/**
 * Check if error is a not null violation
 */
export function isNotNullViolation(error: unknown): boolean {
  const pgError = extractPostgresError(error);
  return pgError?.code === PostgresErrorCode.NOT_NULL_VIOLATION;
}

/**
 * Check if error is a check constraint violation
 */
export function isCheckViolation(error: unknown): boolean {
  const pgError = extractPostgresError(error);
  return pgError?.code === PostgresErrorCode.CHECK_VIOLATION;
}

/**
 * Get constraint name from PostgreSQL error
 * Returns undefined if not found
 */
export function getConstraintName(error: unknown): string | undefined {
  const pgError = extractPostgresError(error);
  return pgError?.constraint_name;
}

/**
 * Check if a database error is for a specific constraint
 */
export function isConstraintViolation(error: unknown, constraintName: string): boolean {
  const constraint = getConstraintName(error);
  return constraint === constraintName;
}

/**
 * Transform unknown database error into typed DatabaseError
 * This is the main entry point for error transformation
 */
export function createDatabaseError(error: unknown): DatabaseError | null {
  const pgError = extractPostgresError(error);
  if (!pgError) {
    return null;
  }

  switch (pgError.code) {
    case PostgresErrorCode.FOREIGN_KEY_VIOLATION:
      return new ForeignKeyViolationError(pgError);
    case PostgresErrorCode.UNIQUE_VIOLATION:
      return new UniqueConstraintError(pgError);
    case PostgresErrorCode.NOT_NULL_VIOLATION:
      return new NotNullViolationError(pgError);
    case PostgresErrorCode.CHECK_VIOLATION:
      return new CheckViolationError(pgError);
    default:
      return new DatabaseError(`Database error: ${pgError.message}`, pgError);
  }
}
