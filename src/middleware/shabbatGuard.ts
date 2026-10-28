import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { isShabbatOrYomTov } from '../utils/hebcal';

/**
 * shabbatGuard: השלב הראשון בכל בקשה ל־API.
 * בשבת ובחג (מהדלקת נרות ועד הבדלה, לפי זמני ירושלים) מחזיר 503 עם שעת היציאה.
 * בדיקת הבריאות /api/health ממשיכה לעבוד, כדי ששירות הענן לא יחשוב שהשרת נפל.
 */
export function shabbatGuard(now: () => Date = () => new Date()) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!env.SHABBAT_GUARD || req.path === '/health') return next();
    const state = isShabbatOrYomTov(now());
    if (!state.closed) return next();
    res.status(503).json({
      error: {
        code: 'SHABBAT',
        message: 'שבת שלום! האתר סגור עד צאת השבת',
        details: { reopensAt: state.reopensAt?.toISOString() ?? null, reopensAtLocal: state.reopensAtLocal },
      },
    });
  };
}
