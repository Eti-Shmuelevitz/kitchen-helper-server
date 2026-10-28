import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { badRequest } from '../utils/httpError';

type Part = 'body' | 'query' | 'params';

/** בודק חלק מהבקשה מול סכמת Zod ושומר את התוצאה הנקייה ב־req.valid */
export function validate(part: Part, schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const fields = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      // ההודעה הראשית מפרטת את הבעיות עצמן, למשל "הסיסמה צריכה לכלול לפחות אות אחת"
      const message = [...new Set(fields.map((f) => f.message))].join(', ');
      return next(badRequest(message || 'יש שדות חסרים או לא תקינים', fields));
    }
    const valid = (res_locals(req).valid ??= {});
    valid[part] = result.data;
    next();
  };
}

interface Locals {
  valid?: Partial<Record<Part, unknown>>;
}

function res_locals(req: Request): Locals {
  return req as unknown as Locals;
}

/** קריאה בטוחה של חלק שעבר בדיקה */
export function valid<S extends ZodTypeAny>(req: Request, part: Part, _schema: S): z.infer<S> {
  return res_locals(req).valid?.[part] as z.infer<S>;
}
