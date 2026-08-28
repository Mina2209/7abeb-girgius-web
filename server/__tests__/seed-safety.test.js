import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Test seed script safety
describe('Seed Script Safety', () => {
  const seedPath = path.join(__dirname, '..', 'prisma', 'seed.js');
  const seedContent = fs.readFileSync(seedPath, 'utf8');

  it('should refuse to run in production', () => {
    // Verify production check exists
    expect(seedContent).toContain("process.env.NODE_ENV === 'production'");
    expect(seedContent).toContain('process.exit(1)');
  });

  it('should not contain hardcoded passwords', () => {
    // Verify no hardcoded passwords
    expect(seedContent).not.toContain('@dmin123$');
    expect(seedContent).not.toContain('TEmPpasSWordFoRaDMin12e4##');
    expect(seedContent).not.toContain('password123');
    expect(seedContent).not.toContain('admin123');
  });

  it('should not print actual passwords to console', () => {
    // Verify passwords are not logged
    // The old code had: console.log('Default users created: admin/TEmPpasSWordFoRaDMin12e4##...')
    // The new code should only print safe messages like "Passwords have been randomly generated"
    // Check that no console.log contains the actual password value
    const consoleLogLines = seedContent.split('\n')
      .filter(line => line.includes('console.log'))
      .join('\n');

    // Should not contain user/password format like "admin/realpassword"
    expect(consoleLogLines).not.toMatch(/admin\/[^\s'"]+/);
    expect(consoleLogLines).not.toMatch(/editor\/[^\s'"]+/);

    // The messages should be safe informational messages
    expect(seedContent).toContain('Passwords have been randomly generated and are NOT displayed');
  });

  it('should generate random passwords', () => {
    // Verify random password generation
    expect(seedContent).toContain('crypto.randomBytes');
    expect(seedContent).toContain('generatePassword');
  });
});
