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

  logger.error('Unexpected error:', err);
  res.status(500).json({
    error: 'Internal server error',
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
