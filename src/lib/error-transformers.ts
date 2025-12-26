import {
  CheckViolationError,
  CONSTRAINTS,
  createDatabaseError,
  ForeignKeyViolationError,
  getConstraintName,
  NotNullViolationError,
  UniqueConstraintError,
} from './database-errors.js';

/**
 * Serializable details for validation errors
 * Can be a string message, structured data with primitive values, or undefined
 */
export type ValidationErrorDetails = string | Record<string, string | number | boolean> | undefined;

/**
 * Domain validation error
 * Used for business logic validation failures
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: ValidationErrorDetails
  ) {
    super(message);
    this.name = 'ValidationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Constraint-to-message mapping for user-friendly error messages
 */
const CONSTRAINT_MESSAGES: Record<string, { message: string; details?: string }> = {
  [CONSTRAINTS.JOBS_COMPANY_FK]: {
    message: 'Invalid company reference',
    details: 'The specified company does not exist',
  },
  [CONSTRAINTS.JOBS_SERVICE_TYPE_FK]: {
    message: 'Invalid service type reference',
    details: 'The specified service type does not exist',
  },
  [CONSTRAINTS.JOB_TEMPLATES_SERVICE_TYPE_FK]: {
    message: 'Invalid service type reference',
    details: 'The specified service type does not exist',
  },
  [CONSTRAINTS.SERVICE_TYPES_CODE_UNIQUE]: {
    message: 'Service type code already exists',
    details: 'A service type with this code is already registered',
  },
  [CONSTRAINTS.JOB_TEMPLATES_CODE_UNIQUE]: {
    message: 'Job template code already exists',
    details: 'A job template with this code is already registered',
  },
  [CONSTRAINTS.JOBS_STATUS_CHECK]: {
    message: 'Invalid job status',
    details: 'Status must be one of: planned, in_progress, completed, canceled',
  },
  [CONSTRAINTS.SERVICE_TYPES_STATUS_CHECK]: {
    message: 'Invalid service type status',
    details: 'Status must be one of: active, deprecated',
  },
  [CONSTRAINTS.SERVICE_TYPES_CODE_CHECK]: {
    message: 'Invalid service type code format',
    details: 'Code must contain only uppercase letters and underscores',
  },
  [CONSTRAINTS.JOB_TEMPLATES_CODE_CHECK]: {
    message: 'Invalid job template code format',
    details: 'Code must contain only uppercase letters, numbers, and underscores',
  },
  [CONSTRAINTS.INVOICES_COMPANY_FK]: {
    message: 'Invalid company reference',
    details: 'The specified company does not exist',
  },
  [CONSTRAINTS.INVOICES_CONTACT_FK]: {
    message: 'Invalid contact reference',
    details: 'The specified contact does not exist',
  },
  [CONSTRAINTS.INVOICES_COMPANY_INVOICE_NUMBER_UNIQUE]: {
    message: 'Duplicate invoice number',
    details: 'An invoice with this number already exists for this company',
  },
  [CONSTRAINTS.INVOICES_TYPE_CHECK]: {
    message: 'Invalid invoice type',
    details: 'Type must be one of: sales, purchase',
  },
  [CONSTRAINTS.INVOICES_STATUS_CHECK]: {
    message: 'Invalid invoice status',
    details: 'Status must be one of: draft, sent, paid, overdue, cancelled',
  },
};

/**
 * Transform database error to domain-specific validation error
 * Returns null if the error is not a database error
 */
export function transformDatabaseError(error: unknown): ValidationError | null {
  const dbError = createDatabaseError(error);
  if (!dbError) {
    return null;
  }

  // Handle foreign key violations
  if (dbError instanceof ForeignKeyViolationError) {
    const constraintName = getConstraintName(error);
    if (constraintName && CONSTRAINT_MESSAGES[constraintName]) {
      const { message, details } = CONSTRAINT_MESSAGES[constraintName];
      return new ValidationError(message, details);
    }
    return new ValidationError('Invalid reference', 'Referenced entity does not exist');
  }

  // Handle unique constraint violations
  if (dbError instanceof UniqueConstraintError) {
    const constraintName = getConstraintName(error);
    if (constraintName && CONSTRAINT_MESSAGES[constraintName]) {
      const { message, details } = CONSTRAINT_MESSAGES[constraintName];
      return new ValidationError(message, details);
    }
    return new ValidationError('Duplicate value', 'This value already exists');
  }

  // Handle not null violations
  if (dbError instanceof NotNullViolationError) {
    const column = dbError.column || 'unknown';
    return new ValidationError(
      'Missing required field',
      `Field '${column}' is required and cannot be null`
    );
  }

  // Handle check constraint violations
  if (dbError instanceof CheckViolationError) {
    const constraintName = getConstraintName(error);
    if (constraintName && CONSTRAINT_MESSAGES[constraintName]) {
      const { message, details } = CONSTRAINT_MESSAGES[constraintName];
      return new ValidationError(message, details);
    }
    return new ValidationError('Invalid value', 'Value does not meet validation requirements');
  }

  // Generic database error
  return new ValidationError('Database operation failed', dbError.message);
}
