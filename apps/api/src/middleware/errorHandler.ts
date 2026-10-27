import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('[Centralized Error Handler]', err);

  const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);

  return res.status(statusCode).json({
    error: err.message || 'An unexpected internal error occurred',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
}
