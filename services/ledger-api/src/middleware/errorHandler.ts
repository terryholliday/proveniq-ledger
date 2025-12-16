/**
 * Error Handler Middleware
 * Implements standard error codes per INTER_APP_CONTRACT.md Section 8.2
 */

import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  errorCode?: string;
  details?: Record<string, unknown>;
}

export const ErrorCodes = {
  INVALID_CUSTODY_TRANSITION: { code: 'INVALID_CUSTODY_TRANSITION', status: 400 },
  LEDGER_HASH_MISMATCH: { code: 'LEDGER_HASH_MISMATCH', status: 409 },
  DUPLICATE_IDEMPOTENCY_KEY: { code: 'DUPLICATE_IDEMPOTENCY_KEY', status: 409 },
  EVENT_NOT_FOUND: { code: 'EVENT_NOT_FOUND', status: 404 },
  ITEM_NOT_FOUND: { code: 'ITEM_NOT_FOUND', status: 404 },
  WALLET_NOT_FOUND: { code: 'WALLET_NOT_FOUND', status: 404 },
  INVALID_PAYLOAD: { code: 'INVALID_PAYLOAD', status: 400 },
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401 },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403 },
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', status: 500 },
} as const;

export function createApiError(
  errorCode: keyof typeof ErrorCodes,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = ErrorCodes[errorCode].status;
  error.errorCode = ErrorCodes[errorCode].code;
  error.details = details;
  return error;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'INTERNAL_ERROR';

  console.error(`[ERROR] ${errorCode}: ${err.message}`, {
    path: req.path,
    method: req.method,
    details: err.details,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message,
      details: err.details,
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  });
}
