import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import '../auth/types';
import type { AuthUser } from '../auth/types';
import { verifyToken } from '../auth/jwt';
import { prisma } from '../db/prisma';
import { forbidden, unauthorized } from '../utils/httpError';

/**
 * requireAuth: דורש Bearer Token תקין. המשתמש נטען ממסד הנתונים בכל בקשה,
 * כך ששינוי תפקיד או הסרה מהבית נכנסים לתוקף מיד.
 * המשתמש נקבע רק לפי ה־token, ולא לפי מזהה שהלקוח שולח.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized('צריך להתחבר (חסר Bearer Token)');
    const userId = verifyToken(token);
    if (!userId) throw unauthorized('הכניסה לא תקפה או שפג תוקפה. צריך להתחבר מחדש');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, color: true, householdId: true },
    });
    if (!user) throw unauthorized('המשתמש לא נמצא');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** requireRole: ממשיך רק לתפקיד המתאים, אחרת 403 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden('רק מנהלת הבית יכולה לבצע את הפעולה הזו'));
    next();
  };
}

export const managerOnly = requireRole('MANAGER');

/** מחזיר את המשתמש המחובר (אחרי requireAuth) */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
