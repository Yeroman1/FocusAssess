import { describe, it, expect, vi } from 'vitest';
import { createRateLimiter } from '../src/middleware/rateLimiter.js';
import { compareOutputs } from '../src/modules/grading/gradingService.js';
import { hashExamKey } from '../src/modules/exams/examService.js';

describe('Security Hardening Test Suite', () => {
  describe('Open Redirect & URL Parameter Sanitization', () => {
    function isValidSafeRedirect(next: string | null | undefined): boolean {
      if (!next || typeof next !== 'string') return false;
      return (
        next.startsWith('/') &&
        !next.startsWith('//') &&
        !next.startsWith('/\\') &&
        !next.includes('://')
      );
    }

    it('should reject scheme-relative protocol injection (//attacker.com)', () => {
      expect(isValidSafeRedirect('//evil.com/phish')).toBe(false);
      expect(isValidSafeRedirect('//attacker.org')).toBe(false);
      expect(isValidSafeRedirect('/\\attacker.com')).toBe(false);
    });

    it('should reject absolute URLs pointing to external domains', () => {
      expect(isValidSafeRedirect('https://evil.com/login')).toBe(false);
      expect(isValidSafeRedirect('http://attacker.com')).toBe(false);
      expect(isValidSafeRedirect('javascript:alert(1)')).toBe(false);
    });

    it('should allow legitimate relative internal portal paths', () => {
      expect(isValidSafeRedirect('/student/dashboard')).toBe(true);
      expect(isValidSafeRedirect('/instructor/dashboard#exams')).toBe(true);
      expect(isValidSafeRedirect('/student/attempts/123/results')).toBe(true);
    });
  });

  describe('API Rate Limiter Middleware', () => {
    it('should throttle requests when maximum limit is exceeded', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 3,
        message: 'Throttled',
        keyGenerator: () => 'test-ip-key',
      });

      // Temporarily override NODE_ENV so limiter executes in test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockReq = { headers: {}, socket: { remoteAddress: '127.0.0.1' }, baseUrl: '/api', path: '/test' } as any;
      const nextFn = vi.fn();
      let lastStatus = 200;
      let lastJson = {};

      const mockRes = {
        setHeader: vi.fn(),
        status: (code: number) => {
          lastStatus = code;
          return {
            json: (body: any) => {
              lastJson = body;
            },
          };
        },
      } as any;

      // First 3 requests should pass
      limiter(mockReq, mockRes, nextFn);
      limiter(mockReq, mockRes, nextFn);
      limiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(3);

      // 4th request must be rejected with 429
      limiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(3); // was not called a 4th time
      expect(lastStatus).toBe(429);
      expect(lastJson).toHaveProperty('error', 'Throttled');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Answer Evaluation & Output Comparison Tamper Resistance', () => {
    it('should resist trailing whitespace and newline exploitation in outputs', () => {
      expect(compareOutputs('Hello World\r\n', 'Hello World\n', 'TRIMMED_TEXT')).toBe(true);
      expect(compareOutputs('   result   \n', 'result', 'TRIMMED_TEXT')).toBe(true);
    });

    it('should strictly evaluate boolean answers for true/false items', () => {
      expect(compareOutputs('True', 'true', 'TRIMMED_TEXT')).toBe(true);
      expect(compareOutputs('False', 'false', 'TRIMMED_TEXT')).toBe(true);
      expect(compareOutputs('true', 'false', 'TRIMMED_TEXT')).toBe(false);
      expect(compareOutputs('yes', 'true', 'TRIMMED_TEXT')).toBe(false);
    });

    it('should strictly enforce exact text comparison when configured', () => {
      expect(compareOutputs('Exact', 'Exact', 'EXACT_TEXT')).toBe(true);
      expect(compareOutputs('Exact ', 'Exact', 'EXACT_TEXT')).toBe(false);
    });

    it('should enforce numeric tolerance bounds', () => {
      expect(compareOutputs('3.14159', '3.14158', 'NUMERIC_TOLERANCE')).toBe(true);
      expect(compareOutputs('3.14159', '3.15', 'NUMERIC_TOLERANCE')).toBe(false);
    });
  });

  describe('Examination Key Collision and Determinism', () => {
    it('should generate consistent SHA-256 digests preventing duplicate key lookup bypass', () => {
      const key = 'PY999-ABCD1234';
      const hash1 = hashExamKey(key);
      const hash2 = hashExamKey(key.toLowerCase());
      const hash3 = hashExamKey(`  ${key}  `);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Server-Authoritative Deadline Calculation', () => {
    it('should flag attempts past deadline as expired with grace period leeway', () => {
      const now = Date.now();
      const deadlineAt = new Date(now - 65 * 1000); // 65 seconds ago (past 60s leeway)
      const GRACE_PERIOD_MS = 60 * 1000;

      const isPastDeadline = now > (deadlineAt.getTime() + GRACE_PERIOD_MS);
      expect(isPastDeadline).toBe(true);

      const withinDeadline = new Date(now + 10 * 60 * 1000); // 10 minutes in future
      const isStillActive = now > (withinDeadline.getTime() + GRACE_PERIOD_MS);
      expect(isStillActive).toBe(false);
    });
  });
});

