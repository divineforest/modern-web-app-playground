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
  [CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE]: {
    message: 'Duplicate order number',
    details: 'An order with this number already exists',
  },
  [CONSTRAINTS.ORDERS_STATUS_CHECK]: {
    message: 'Invalid order status',
    details:
      'Status must be one of: draft, confirmed, processing, shipped, fulfilled, paid, cancelled, cart',
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
