import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  const start = Date.now();
  const path = req.path;
  const method = req.method;
  req.on('end', () => {
    const duration = Date.now() - start;
    console.log(`${method} ${path} ${duration}ms`);
  });
  next();
}
