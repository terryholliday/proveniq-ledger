/**
 * Request Logger Middleware
 */

import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      idempotencyKey: idempotencyKey || 'none',
      timestamp: new Date().toISOString(),
    };

    if (res.statusCode >= 400) {
      console.error('[REQUEST]', JSON.stringify(log));
    } else {
      console.log('[REQUEST]', JSON.stringify(log));
    }
  });

  next();
}
