import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { RunnerJobRequest, RunnerJobResponse, RunnerExecutionStatus } from '@pyassess/shared';

const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB
const DEFAULT_TIMEOUT_MS = 3000;    // 3 seconds

/**
 * Executes Python code in an isolated ephemeral directory with resource & time constraints.
 */
export async function executePythonSandbox(request: RunnerJobRequest): Promise<RunnerJobResponse> {
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pyassess-run-'));
  const scriptPath = path.join(tempDir, 'solution.py');

  const startTime = Date.now();

  try {
    // 1. Write the solution code into the isolated ephemeral directory
    await fs.writeFile(scriptPath, request.sourceCode, 'utf8');

    // 2. Prepare minimal clean environment (strictly omit DB/Supabase/API secrets!)
    const cleanEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH || '',
      SYSTEMROOT: process.env.SYSTEMROOT || '',
      TEMP: tempDir,
      TMP: tempDir,
      PYTHONUNBUFFERED: '1',
      PYTHONDONTWRITEBYTECODE: '1',
    };

    // 3. Determine Python command
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    return await new Promise<RunnerJobResponse>((resolve) => {
      let isSettled = false;
      let stdoutAcc = '';
      let stderrAcc = '';
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let executionStatus: RunnerExecutionStatus = 'SUCCESS';

      // Run Python in isolated mode (-I) to ignore PYTHONPATH, user site-packages, and external state
      const child = spawn(pythonCmd, ['-I', '-B', '-u', scriptPath], {
        cwd: tempDir,
        env: cleanEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      // Timeout watchdog
      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          executionStatus = 'TIME_LIMIT_EXCEEDED';
          try {
            if (process.platform === 'win32' && child.pid) {
              spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
            } else {
              child.kill('SIGKILL');
            }
          } catch {
            // ignore kill errors
          }
          resolve({
            jobId: request.jobId,
            stdout: stdoutAcc,
            stderr: stderrAcc + '\n[Execution timed out]',
            exitCode: -1,
            durationMs: Date.now() - startTime,
            executionStatus: 'TIME_LIMIT_EXCEEDED',
            error: `Execution exceeded wall-clock limit of ${timeoutMs}ms`,
          });
        }
      }, timeoutMs);

      // Feed standard input
      if (request.stdin) {
        child.stdin.write(request.stdin);
      }
      child.stdin.end();

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > MAX_OUTPUT_BYTES) {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timer);
            try {
              child.kill('SIGKILL');
            } catch {
              // ignore
            }
            resolve({
              jobId: request.jobId,
              stdout: stdoutAcc.slice(0, MAX_OUTPUT_BYTES),
              stderr: stderrAcc + '\n[Output size limit exceeded]',
              exitCode: -1,
              durationMs: Date.now() - startTime,
              executionStatus: 'OUTPUT_LIMIT_EXCEEDED',
              error: 'Output exceeded maximum permitted limit of 64KB',
            });
          }
        } else {
          stdoutAcc += chunk.toString('utf8');
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes <= MAX_OUTPUT_BYTES) {
          stderrAcc += chunk.toString('utf8');
        }
      });

      child.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          resolve({
            jobId: request.jobId,
            stdout: stdoutAcc,
            stderr: stderrAcc + `\n${err.message}`,
            exitCode: -1,
            durationMs: Date.now() - startTime,
            executionStatus: 'INTERNAL_ERROR',
            error: err.message,
          });
        }
      });

      child.on('close', (code) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          const durationMs = Date.now() - startTime;
          const exitCode = code ?? 0;

          if (exitCode !== 0) {
            if (stderrAcc.includes('SyntaxError')) {
              executionStatus = 'SYNTAX_ERROR';
            } else if (stderrAcc.includes('MemoryError')) {
              executionStatus = 'MEMORY_LIMIT_EXCEEDED';
            } else {
              executionStatus = 'RUNTIME_ERROR';
            }
          }

          resolve({
            jobId: request.jobId,
            stdout: stdoutAcc,
            stderr: stderrAcc,
            exitCode,
            durationMs,
            executionStatus,
            error: exitCode !== 0 ? stderrAcc.trim() : undefined,
          });
        }
      });
    });
  } catch (err: any) {
    return {
      jobId: request.jobId,
      stdout: '',
      stderr: err?.message || String(err),
      exitCode: -1,
      durationMs: Date.now() - startTime,
      executionStatus: 'INTERNAL_ERROR',
      error: err?.message || String(err),
    };
  } finally {
    // 4. Always securely delete the ephemeral working directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
