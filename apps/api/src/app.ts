import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './modules/auth/authRoutes.js';
import { examRoutes } from './modules/exams/examRoutes.js';
import { attemptRoutes } from './modules/attempts/attemptRoutes.js';
import { monitoringRoutes } from './modules/monitoring/monitoringRoutes.js';
import { instructorRoutes } from './modules/instructor/instructorRoutes.js';
import { adminRoutes } from './modules/admin/adminRoutes.js';

import { createRateLimiter } from './middleware/rateLimiter.js';

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Let Next.js handle frontend CSP
  }));

  // Global API rate limiter (180 requests per minute)
  const globalLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 180,
    message: 'Too many requests from this network. Please slow down.',
  });
  app.use('/api/v1', globalLimiter);

  // CORS configuration
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching origin
      if (!origin || origin.startsWith('http://localhost') || origin === config.corsOrigin) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-runner-secret'],
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Prevent caching of authenticated API responses
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Request logger
  app.use((req, _res, next) => {
    console.log(`[API Request] ${req.method} ${req.url} - Referer: ${req.headers.referer}`);
    next();
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'focusassess-api',
      timestamp: new Date().toISOString(),
    });
  });

  // Versioned API routes under /api/v1
  const apiRouter = express.Router();
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/exams', examRoutes);
  apiRouter.use('/', attemptRoutes);
  apiRouter.use('/', monitoringRoutes);
  apiRouter.use('/instructor', instructorRoutes);
  apiRouter.use('/admin', adminRoutes);

  app.use('/api/v1', apiRouter);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
