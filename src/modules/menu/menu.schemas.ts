import { z } from 'zod';
import { isoDate } from '../../utils/dates';

export const meal = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SHABBAT_NIGHT', 'SHABBAT_DAY', 'SEUDA_SHLISHIT', 'YOM_TOV']);

export const menuQuery = z.object({ week: isoDate.optional() });

export const createEntrySchema = z.object({
  date: isoDate,
  meal,
  recipeId: z.string().uuid('מזהה מתכון לא תקין'),
  servings: z.number().int().min(1).max(50).optional(),
});

export const updateEntrySchema = z
  .object({
    date: isoDate.optional(),
    meal: meal.optional(),
    servings: z.number().int().min(1).max(50).optional(),
    order: z.number().int().min(0).max(100).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'לא נשלח שום שדה לעדכון');
