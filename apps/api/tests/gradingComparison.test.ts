import { describe, it, expect } from 'vitest';
import { compareOutputs } from '../src/modules/grading/gradingService.js';

describe('Grading Engine Output Comparison Modes', () => {
  describe('TRIMMED_TEXT Mode (Default)', () => {
    it('should match identical output', () => {
      expect(compareOutputs('42\n', '42', 'TRIMMED_TEXT')).toBe(true);
    });

    it('should ignore trailing and leading whitespace or newlines', () => {
      expect(compareOutputs('\n   [1, 2, 3]  \r\n', '[1, 2, 3]', 'TRIMMED_TEXT')).toBe(true);
    });

    it('should match multiline output regardless of CRLF vs LF', () => {
      const actual = 'Line 1\r\nLine 2\r\nLine 3\n';
      const expected = 'Line 1\nLine 2\nLine 3';
      expect(compareOutputs(actual, expected, 'TRIMMED_TEXT')).toBe(true);
    });

    it('should reject different internal words or values', () => {
      expect(compareOutputs('Hello World', 'Hello Python', 'TRIMMED_TEXT')).toBe(false);
    });
  });

  describe('EXACT_TEXT Mode', () => {
    it('should require byte-for-byte exact match', () => {
      expect(compareOutputs('Exact Output\n', 'Exact Output\n', 'EXACT_TEXT')).toBe(true);
      expect(compareOutputs('Exact Output\n', 'Exact Output', 'EXACT_TEXT')).toBe(false);
    });
  });

  describe('NUMERIC_TOLERANCE Mode', () => {
    it('should match numbers within 1e-4 tolerance', () => {
      expect(compareOutputs('3.14159', '3.14158', 'NUMERIC_TOLERANCE')).toBe(true);
      expect(compareOutputs('100.00001', '100.0', 'NUMERIC_TOLERANCE')).toBe(true);
    });

    it('should reject numbers outside tolerance', () => {
      expect(compareOutputs('3.1415', '3.1500', 'NUMERIC_TOLERANCE')).toBe(false);
    });
  });
});
