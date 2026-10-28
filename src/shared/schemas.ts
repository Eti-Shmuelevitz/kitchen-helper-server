import { z } from 'zod';

export const idParam = z.object({ id: z.string().uuid('מזהה לא תקין') });
export const password = z
  .string()
  .min(8, 'סיסמה של 8 תווים לפחות')
  .max(72)
  .regex(/[A-Za-zא-ת]/, 'הסיסמה צריכה לכלול לפחות אות אחת')
  .regex(/\d/, 'הסיסמה צריכה לכלול לפחות ספרה אחת');
export const personName = z.string().trim().min(2, 'שם של 2 תווים לפחות').max(30, 'שם של עד 30 תווים');
export const email = z.string().trim().toLowerCase().email('מייל לא תקין').max(120);
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'צבע בפורמט #RRGGBB');
export const page = z.coerce.number().int().min(1).default(1);
export const pageSize = z.coerce.number().int().min(1).max(100).default(20);
/** פרמטר true/false בכתובת */
export const boolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');
