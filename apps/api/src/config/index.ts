import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('4000'),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  INITIAL_ADMIN_EMAIL: z.string().email().optional().default('admin@astu.edu.et'),
  PYTHON_RUNNER_URL: z.string().url().default('http://localhost:5001'),
  PYTHON_RUNNER_SECRET: z.string().default('dev-isolated-runner-secret-key-astu-2026'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('120'),
});

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.warn('[Config Warning] Missing or invalid environment variables. Using sensible development defaults:', parsedEnv.error.flatten());
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pyassess?schema=public',
  directUrl: process.env.DIRECT_URL,
  supabaseUrl: process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || 'placeholder-service-role-key',
  initialAdminEmail: (process.env.INITIAL_ADMIN_EMAIL || 'admin@astu.edu.et').toLowerCase(),
  pythonRunnerUrl: process.env.PYTHON_RUNNER_URL || 'http://localhost:5001',
  pythonRunnerSecret: process.env.PYTHON_RUNNER_SECRET || 'dev-isolated-runner-secret-key-astu-2026',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};
