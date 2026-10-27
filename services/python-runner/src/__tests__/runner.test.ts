import { describe, it, expect } from 'vitest';
import { executePythonSandbox } from '../sandbox.js';

describe('Python Sandbox Isolated Runner', () => {
  it('should successfully execute valid Python code and return stdout', async () => {
    const result = await executePythonSandbox({
      jobId: 'test-1',
      sourceCode: `
import sys
name = sys.stdin.read().strip()
print(f"Hello, {name}!")
`,
      stdin: 'ASTU Candidate',
      timeoutMs: 3000,
    });

    expect(result.executionStatus).toBe('SUCCESS');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('Hello, ASTU Candidate!');
  });

  it('should catch Python syntax errors accurately', async () => {
    const result = await executePythonSandbox({
      jobId: 'test-syntax-error',
      sourceCode: `
def broken_fn(
    print("missing closing paren"
`,
      stdin: '',
      timeoutMs: 3000,
    });

    expect(result.executionStatus).toBe('SYNTAX_ERROR');
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('SyntaxError');
  });

  it('should catch runtime exceptions such as ZeroDivisionError', async () => {
    const result = await executePythonSandbox({
      jobId: 'test-runtime-error',
      sourceCode: `
x = 10 / 0
print(x)
`,
      stdin: '',
      timeoutMs: 3000,
    });

    expect(result.executionStatus).toBe('RUNTIME_ERROR');
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('ZeroDivisionError');
  });

  it('should terminate infinite loops within the timeout boundary (TIME_LIMIT_EXCEEDED)', async () => {
    const startTime = Date.now();
    const result = await executePythonSandbox({
      jobId: 'test-timeout',
      sourceCode: `
import time
while True:
    time.sleep(0.05)
`,
      stdin: '',
      timeoutMs: 1200, // 1.2s timeout
    });

    const elapsed = Date.now() - startTime;
    expect(result.executionStatus).toBe('TIME_LIMIT_EXCEEDED');
    expect(elapsed).toBeGreaterThanOrEqual(1100);
    expect(elapsed).toBeLessThan(3500);
  });
});
