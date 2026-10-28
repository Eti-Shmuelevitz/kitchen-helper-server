import { z } from 'zod';
import { isoDate } from '../../utils/dates';
import { department } from '../ingredients/ingredients.schemas';

export const shoppingQuery = z.object({ week: isoDate.optional() });

export const addItemSchema = z.object({
  name: z.string().trim().min(1, 'חסר שם פריט').max(40, 'עד 40 תווים'),
  category: department,
  quantity: z.number().positive().max(10000).optional(),
  unit: z.string().trim().min(1).max(15).optional(),
  ingredientId: z.string().uuid().optional(),
});

export const reviewSchema = z.object({ action: z.enum(['approve', 'decline']) });

export const boughtSchema = z
  .object({
    itemId: z.string().uuid().optional(),
    ingredientId: z.string().uuid().optional(),
    bought: z.boolean(),
    week: isoDate.optional(),
  })
  .refine((v) => !!v.itemId !== !!v.ingredientId, 'שולחים itemId (פריט שנוסף) או ingredientId (פריט מהתפריט), אחד מהם');

export const finishSchema = z.object({ week: isoDate.optional() });
