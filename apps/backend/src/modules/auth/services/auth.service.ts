import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { Database } from '../../../db/index.js';
import { db } from '../../../db/index.js';
import { env } from '../../../lib/env.js';
import { createModuleLogger } from '../../../lib/logger.js';

const logger = createModuleLogger('auth');
import { mergeGuestCart } from '../../cart/services/cart.service.js';
import type { LoginInput, RegisterInput, UserProfile } from '../domain/auth.types.js';
import {
  createSession,
  createUser,
  deleteSessionByToken,
  findSessionByToken,
  findUserByEmail,
  findUserById,
  updateSessionExpiry,
} from '../repositories/auth.repository.js';

/**
 * Custom errors
 */
export class EmailAlreadyExistsError extends Error {
  constructor(message = 'An account with this email address already exists') {
    super(message);
    this.name = 'EmailAlreadyExistsError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor(message = 'Invalid email or password') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class SessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class SessionNotFoundError extends Error {
  constructor(message = 'Session not found') {
    super(message);
    this.name = 'SessionNotFoundError';
  }
}

export class UserNotFoundError extends Error {
  constructor(message = 'User not found') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

/**
 * Format user as profile (omit password, salt, etc.)
 */
function formatUserProfile(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean | null;
  createdAt: Date;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isAdmin: user.isAdmin || false,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Calculate session expiry date
 */
function calculateSessionExpiry(): Date {
  const expiryDays = env.SESSION_EXPIRY_DAYS;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  return expiryDate;
}

/**
 * Register a new user
 */
export async function register(
  input: RegisterInput,
  database: Database = db
): Promise<{ user: UserProfile; sessionToken: string }> {
  // Check if email already exists
  const existingUser = await findUserByEmail(input.email, database);

  if (existingUser) {
    throw new EmailAlreadyExistsError();
  }

  // Hash password with argon2id
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });

  // Create user (salt column left empty since argon2id embeds salt in hash)
  const user = await createUser(
    {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: passwordHash,
      salt: '',
    },
    database
  );

  // Generate session token
  const sessionToken = randomBytes(32).toString('hex');
  const expiresAt = calculateSessionExpiry();

  // Create session
  await createSession(user.id, sessionToken, expiresAt, database);

  logger.info({ userId: user.id, email: user.email }, 'User registered successfully');

  return {
    user: formatUserProfile(user),
    sessionToken,
  };
}

/**
 * Login user with email and password
 * Includes cart merge if guest cart token provided
 */
export async function login(
  input: LoginInput,
  cartToken: string | undefined,
  database: Database = db
): Promise<{ user: UserProfile; sessionToken: string; cartMerged: boolean }> {
  // Lookup user by email
  const user = await findUserByEmail(input.email, database);

  if (!user) {
    // Fixed delay to prevent timing-based enumeration
    await new Promise((resolve) => setTimeout(resolve, 100));
    throw new InvalidCredentialsError();
  }

  // Verify password
  let passwordValid = false;
  try {
    passwordValid = await argon2.verify(user.password, input.password);
  } catch {
    logger.warn({ email: input.email }, 'Password verification failed');
    throw new InvalidCredentialsError();
  }

  if (!passwordValid) {
    throw new InvalidCredentialsError();
  }

  // Begin transaction: create session and merge cart if needed
  let cartMerged = false;
  const sessionToken = randomBytes(32).toString('hex');
  const expiresAt = calculateSessionExpiry();

  await database.transaction(async (tx) => {
    // Create session
    await createSession(user.id, sessionToken, expiresAt, tx as unknown as Database);

    // Merge guest cart if token provided
    if (cartToken) {
      try {
        await mergeGuestCart(user.id, cartToken, tx as unknown as Database);
        cartMerged = true;
        logger.info({ userId: user.id, cartToken }, 'Guest cart merged on login');
      } catch (error) {
        // Log but don't fail login if cart merge fails
        logger.warn({ userId: user.id, cartToken, error }, 'Failed to merge guest cart on login');
      }
    }
  });

  logger.info({ userId: user.id, email: user.email, cartMerged }, 'User logged in successfully');

  return {
    user: formatUserProfile(user),
    sessionToken,
    cartMerged,
  };
}

/**
 * Logout user by invalidating session
 */
export async function logout(token: string, database: Database = db): Promise<void> {
  await deleteSessionByToken(token, database);
  logger.info({ token: token.substring(0, 8) }, 'User logged out');
}

/**
 * Get current user profile by user ID
 */
export async function getMe(userId: string, database: Database = db): Promise<UserProfile> {
  const user = await findUserById(userId, database);

  if (!user) {
    throw new UserNotFoundError();
  }

  return formatUserProfile(user);
}

/**
 * Validate session token and return user
 * Updates sliding expiry window
 */
export async function validateSession(
  token: string,
  database: Database = db
): Promise<UserProfile> {
  const result = await findSessionByToken(token, database);

  if (!result) {
    throw new SessionNotFoundError();
  }

  const { session, user } = result;

  // Check if session is expired
  if (new Date() > new Date(session.expiresAt)) {
    await deleteSessionByToken(token, database);
    throw new SessionExpiredError();
  }

  // Update sliding expiry window
  const newExpiresAt = calculateSessionExpiry();
  const lastUsedAt = new Date();
  await updateSessionExpiry(session.id, newExpiresAt, lastUsedAt, database);

  return formatUserProfile(user);
}

export const authService = {
  register,
  login,
  logout,
  getMe,
  validateSession,
};
