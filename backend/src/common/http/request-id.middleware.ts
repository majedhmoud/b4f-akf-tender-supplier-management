import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

// Gives every request an ID that appears in error responses and logs, so a
// reported error can be traced (ENGINEERING_STANDARDS.md §8).
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = `req_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
