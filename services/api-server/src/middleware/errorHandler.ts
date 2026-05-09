import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ApiError) {
    logger.warn(`API Error [${err.statusCode}]: ${err.message}`, err.details);
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }

  // Pino best practice: pass err as object so it's serialized properly
  logger.error({ err: { name: err.name, message: err.message, stack: err.stack } }, 'Unexpected error');
  // Surface message/stack for debugging (will tighten later if abuse appears)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    name: err.name,
  });
}

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
  });
}
