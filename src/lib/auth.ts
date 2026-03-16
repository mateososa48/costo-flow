import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

/**
 * Hash a plaintext password with bcrypt.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored value.
 * Handles migration: if stored value is not a bcrypt hash (legacy plaintext),
 * falls back to direct comparison.
 */
export async function verifyPassword(
  plain: string,
  stored: string
): Promise<boolean> {
  // bcrypt hashes start with "$2a$", "$2b$", or "$2y$"
  if (stored.startsWith("$2")) {
    return bcrypt.compare(plain, stored);
  }
  // Legacy plaintext comparison
  return plain === stored;
}

/**
 * Check if a stored password is already hashed.
 */
export function isHashed(stored: string): boolean {
  return stored.startsWith("$2");
}
