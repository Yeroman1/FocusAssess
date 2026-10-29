// In-Memory Sliding Window Rate Limiter for FocusAssess API
import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests. Please slow down and try again later.',
    keyGenerator = (req: Request) => {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || 'unknown';
      return `${ip}:${req.baseUrl || req.path}`;
    },
  } = options;

  const hits = new Map<string, RateLimitRecord>();

  // Periodic cleanup of stale entries every 5 minutes to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting during automated unit tests
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const now = Date.now();
    const key = keyGenerator(req);
    let record = hits.get(key);

    if (!record) {
      record = { timestamps: [] };
      hits.set(key, record);
    }

    // Filter out timestamps outside window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= max) {
      const oldest = record.timestamps[0];
      const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000);

      res.setHeader('Retry-After', retryAfterSec.toString());
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', '0');

      return res.status(429).json({
        error: message,
        retryAfter: retryAfterSec,
      });
    }

    record.timestamps.push(now);

    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.timestamps.length).toString());

    return next();
  };
}

