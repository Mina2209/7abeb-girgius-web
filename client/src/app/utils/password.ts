// Mirrors the server-side policy in server/utils/password-policy.js so the UI
// gives instant feedback and the backend stays the source of truth/enforcement.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /[0-9]/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;

export interface PasswordCheck {
  valid: boolean;
  reasons: string[];
}

export function checkPassword(password: string): PasswordCheck {
  const reasons: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    reasons.push(`At least ${PASSWORD_MIN_LENGTH} characters required`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    reasons.push(`At most ${PASSWORD_MAX_LENGTH} characters allowed`);
  }
  if (!HAS_LOWER.test(password)) {
    reasons.push('A lowercase letter required');
  }
  if (!HAS_UPPER.test(password)) {
    reasons.push('An uppercase letter required');
  }
  if (!HAS_DIGIT.test(password)) {
    reasons.push('A number required');
  }
  if (!HAS_SPECIAL.test(password)) {
    reasons.push('A special character (e.g. !@#$%) required');
  }

  return { valid: reasons.length === 0, reasons };
}