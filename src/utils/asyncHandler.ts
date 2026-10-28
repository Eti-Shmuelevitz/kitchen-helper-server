import type { NextFunction, Request, RequestHandler, Response } from 'express';

// עוטף פונקציה אסינכרונית כך ששגיאות יגיעו ל־errorHandler
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
