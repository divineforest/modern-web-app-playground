/**
 * Error thrown when a pagination cursor has an invalid format
 */
export class InvalidCursorError extends Error {
  constructor() {
    super('Invalid cursor format');
    this.name = 'InvalidCursorError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when cursor sort configuration does not match the request sort
 */
export class CursorSortMismatchError extends Error {
  constructor() {
    super('Cursor sort configuration does not match request sort');
    this.name = 'CursorSortMismatchError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
