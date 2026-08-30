/**
 * Password strength policy shared by registration, user creation, and
 * self-service password change.
 *
 * Requirements (Finding 9 / Task 7):
 * - min 8 characters, max 128
 * - at least one lowercase letter
 * - at least one uppercase letter
 * - at least one digit
 * - at least one special (non-alphanumeric) character
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /[0-9]/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;

/**
 * Validate a candidate password against the policy.
 * @param {unknown} password
 * @returns {{ ok: boolean, error?: string }}
 */
export function validatePassword(password) {
  if (typeof password !== 'string') {
    return { ok: false, error: 'Password must be a string' };
  }
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      error: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
    };
  }
  if (!HAS_LOWER.test(password)) {
    return { ok: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!HAS_UPPER.test(password)) {
    return { ok: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!HAS_DIGIT.test(password)) {
    return { ok: false, error: 'Password must contain at least one number' };
  }
  if (!HAS_SPECIAL.test(password)) {
    return { ok: false, error: 'Password must contain at least one special character (e.g. !@#$%)' };
  }
  return { ok: true };
}

export const passwordPolicy = {
  minLength: PASSWORD_MIN_LENGTH,
  maxLength: PASSWORD_MAX_LENGTH,
  requireLowercase: true,
  requireUppercase: true,
  requireDigit: true,
  requireSpecial: true,
};