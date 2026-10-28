import { z } from 'zod';
import { color, email, password, personName } from '../../shared/schemas';

// הרשמה: כל אחת בוחרת תפקיד. מנהלת הבית חייבת קוד מנהלת
export const registerSchema = z
  .object({
    name: personName,
    email,
    password,
    role: z.enum(['MANAGER', 'MEMBER'], { required_error: 'צריך לבחור תפקיד' }),
    managerCode: z.string().trim().max(50).optional(),
  })
  .refine((v) => v.role !== 'MANAGER' || !!v.managerCode, {
    message: 'כדי להירשם כמנהלת הבית צריך קוד מנהלת',
    path: ['managerCode'],
  });

export const loginSchema = z.object({ email, password: z.string().min(1, 'חסרה סיסמה') });

export const updateMeSchema = z
  .object({
    name: personName.optional(),
    color: color.optional(),
    currentPassword: z.string().optional(),
    newPassword: password.optional(),
  })
  .refine((v) => !v.newPassword || !!v.currentPassword, {
    message: 'כדי להחליף סיסמה צריך להזין את הסיסמה הנוכחית',
    path: ['currentPassword'],
  });
