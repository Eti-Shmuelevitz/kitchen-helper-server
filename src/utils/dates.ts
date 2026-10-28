import { z } from 'zod';
import { env } from '../config/env';

// תאריכים ״קלנדריים״ נשמרים כמחרוזת YYYY-MM-DD, לפי שעון ישראל.

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך בפורמט YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && toDbDate(s).toISOString().startsWith(s), 'תאריך לא תקין');

/** התאריך של היום (או של רגע נתון) בשעון ישראל */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: env.TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** ממיר YYYY-MM-DD לערך ששומרים בשדה Date במסד */
export const toDbDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** ממיר ערך Date מהמסד ל־YYYY-MM-DD */
export const fromDbDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  const d = toDbDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDbDate(d);
}

/** 0 = ראשון ... 6 = שבת */
export const dayOfWeek = (iso: string) => toDbDate(iso).getUTCDay();

/** getWeekStart: יום ראשון של השבוע שבו נמצא התאריך */
export const getWeekStart = (iso: string) => addDays(iso, -dayOfWeek(iso));

/** getWeekDates: שבעת התאריכים של השבוע, מראשון עד שבת */
export const getWeekDates = (weekStart: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

/** שעה בפורמט HH:mm לפי שעון ישראל */
export function localTime(d: Date): string {
  return new Intl.DateTimeFormat('he-IL', { timeZone: env.TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}
