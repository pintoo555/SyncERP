import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error | AppError | ZodError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    res.status(400).json({ success: false, error: message, validationErrors: err.flatten() });
    return;
  }

  const status = err instanceof AppError ? err.statusCode : 500;
  let message: string;
  if (err instanceof AppError) {
    message = err.message;
  } else if (err instanceof Error && err.message && typeof err.message === 'string') {
    const raw = err.message.trim();
    message = raw.length <= 400 && !raw.includes('\n') ? raw : 'Internal server error';
  } else {
    message = 'Internal server error';
  }
  const code = err instanceof AppError ? err.code : undefined;

  if (status >= 500 && err instanceof Error) {
    console.error('[500]', err.message);
    console.error(err.stack);
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(code && { code }),
  });
}
