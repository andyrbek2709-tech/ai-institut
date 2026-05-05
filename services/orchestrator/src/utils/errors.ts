export class OrchestratorError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

export class RetryableError extends OrchestratorError {
  constructor(message: string, code: string) {
    super(message, code, true);
    this.name = 'RetryableError';
  }
}

export class ValidationError extends OrchestratorError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', false);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends OrchestratorError {
  constructor(message: string, retryable: boolean = true) {
    super(message, 'DATABASE_ERROR', retryable);
    this.name = 'DatabaseError';
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  delayMs: number,
  logger: any,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const err = error instanceof OrchestratorError ? error : new RetryableError(lastError.message, 'UNKNOWN_ERROR');

      if (!err.retryable || attempt === maxRetries) {
        throw err;
      }

      const delay = delayMs * Math.pow(2, attempt - 1);
      logger.warn(
        { attempt, delay, error: lastError.message },
        'Retry attempt',
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Unknown error in retry loop');
}
