import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { z } from 'zod';
import { executePythonSandbox } from './sandbox.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '1mb' }));

const RUNNER_PORT = process.env.RUNNER_PORT ? parseInt(process.env.RUNNER_PORT, 10) : 5001;
const RUNNER_SECRET = process.env.RUNNER_SECRET || 'pyassess-dev-runner-secret';

const ExecuteSchema = z.object({
  jobId: z.string().min(1),
  sourceCode: z.string(),
  stdin: z.string().default(''),
  timeoutMs: z.number().int().min(500).max(10000).optional(),
  memoryLimitMb: z.number().int().min(16).max(512).optional(),
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'python-runner',
    timestamp: new Date().toISOString(),
  });
});

// Internal execution endpoint
app.post('/internal/execute', async (req: Request, res: Response) => {
  const secretHeader = req.headers['x-runner-secret'];
  if (!secretHeader || secretHeader !== RUNNER_SECRET) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing internal runner secret',
    });
  }

  const parseResult = ExecuteSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: parseResult.error.flatten(),
    });
  }

  try {
    const result = await executePythonSandbox(parseResult.data);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal runner failure',
      details: err?.message || String(err),
    });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(RUNNER_PORT, () => {
    console.log(`[FocusAssess Python Runner] Listening on port ${RUNNER_PORT}`);
  });
}

export { app };
