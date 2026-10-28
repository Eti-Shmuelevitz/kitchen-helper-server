import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';

// הגבלת קצב פשוטה בזיכרון. מספיקה לשרת אחד.

const allLimiters: Map<string, { count: number; resetAt: number }>[] = [];

/** לכל שימוש ב־rateLimit יש מונה משלו, לפי כתובת IP */
export function rateLimit(limit = 100, windowMs = 60_000) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  allLimiters.push(hits);
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const cur = hits.get(key);
    if (!cur || cur.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    cur.count += 1;
    if (cur.count > limit) return next(new HttpError(429, 'TOO_MANY_REQUESTS', 'יותר מדי בקשות. נסי שוב בעוד דקה'));
    next();
  };
}

// נעילת כניסה: 5 ניסיונות שגויים → נעילה ל־15 דקות לאותו מייל
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;
const fails = new Map<string, { count: number; lockedUntil: number }>();

export function assertNotLocked(email: string): void {
  const f = fails.get(email);
  if (f && f.lockedUntil > Date.now()) {
    throw new HttpError(429, 'TOO_MANY_REQUESTS', 'יותר מדי ניסיונות כניסה. נסי שוב בעוד 15 דקות');
  }
}

export function recordLoginFailure(email: string): void {
  const f = fails.get(email) ?? { count: 0, lockedUntil: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILS) {
    f.lockedUntil = Date.now() + LOCK_MS;
    f.count = 0;
  }
  fails.set(email, f);
}

export function clearLoginFailures(email: string): void {
  fails.delete(email);
}

/** לבדיקות בלבד */
export function resetRateLimits(): void {
  allLimiters.forEach((m) => m.clear());
  fails.clear();
}
