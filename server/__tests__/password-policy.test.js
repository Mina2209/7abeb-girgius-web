import { describe, it, expect } from 'vitest';
import { validatePassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, passwordPolicy } from '../utils/password-policy.js';

describe('password policy', () => {
  it('accepts a strong password', () => {
    expect(validatePassword('StrongP@ss1')).toEqual({ ok: true });
  });

  it('rejects passwords shorter than the minimum', () => {
    const r = validatePassword('Sho@rt1');
    expect(r.ok).toBe(false);
    expect(r.error).toContain(`between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH}`);
  });

  it('rejects passwords longer than the maximum', () => {
    const r = validatePassword('A' + 'b1'.repeat(70) + '@');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('between');
  });

  it('rejects missing lowercase', () => {
    const r = validatePassword('ABCDEF1@');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('lowercase');
  });

  it('rejects missing uppercase', () => {
    const r = validatePassword('abcdef1@');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('uppercase');
  });

  it('rejects missing digit', () => {
    const r = validatePassword('Abcdefg@');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('number');
  });

  it('rejects missing special character', () => {
    const r = validatePassword('Abcdefg1');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('special');
  });

  it('rejects non-string input', () => {
    expect(validatePassword(12345).ok).toBe(false);
    expect(validatePassword(null).ok).toBe(false);
    expect(validatePassword(undefined).ok).toBe(false);
  });

  it('exposes the policy configuration for UI mirroring', () => {
    expect(passwordPolicy.minLength).toBe(8);
    expect(passwordPolicy.requireUppercase).toBe(true);
    expect(passwordPolicy.requireLowercase).toBe(true);
    expect(passwordPolicy.requireDigit).toBe(true);
    expect(passwordPolicy.requireSpecial).toBe(true);
  });
});