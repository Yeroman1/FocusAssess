import { describe, it, expect } from 'vitest';
import { generateSecureExamKey, hashExamKey } from '../src/modules/exams/examService.js';

describe('Cryptographic Examination Key Utilities', () => {
  it('should generate non-predictable, formatted exam keys', () => {
    const key1 = generateSecureExamKey('CS204');
    const key2 = generateSecureExamKey('CS204');

    expect(key1).toMatch(/^CS204-[A-F0-9]{8}$/);
    expect(key2).toMatch(/^CS204-[A-F0-9]{8}$/);
    expect(key1).not.toBe(key2);
  });

  it('should hash exam keys using SHA-256 with consistent normalized case', () => {
    const rawKey = 'PY204-A1B2C3D4';
    const hash1 = hashExamKey(rawKey);
    const hash2 = hashExamKey('   py204-a1b2c3d4  '); // case-insensitive, whitespace-trimmed

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string length
  });
});
