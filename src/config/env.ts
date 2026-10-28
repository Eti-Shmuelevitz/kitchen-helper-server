import 'dotenv/config';
import { z } from 'zod';

// כל ההגדרות מגיעות ממשתני סביבה. אם חסר משהו חובה, השרת לא עולה ומסביר למה.
const bool = (def: 'true' | 'false') =>
  z
    .string()
    .default(def)
    .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL חסר'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET חייב להיות באורך 32 תווים לפחות'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  PUBLIC_URL: z.string().default('http://localhost:4000'),
  // האתר סגור בשבת ובחג (זמני ירושלים). false רק לבדיקות או לפיתוח
  SHABBAT_GUARD: bool('true'),
  // הקוד שמאפשר להירשם כמנהלת הבית
  MANAGER_CODE: z.string().min(1).default('1357'),
  TIMEZONE: z.string().default('Asia/Jerusalem'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('שגיאה בהגדרות הסביבה:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
