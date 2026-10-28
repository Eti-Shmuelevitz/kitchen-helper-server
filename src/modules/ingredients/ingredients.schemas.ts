import { z } from 'zod';

export const department = z.enum(['PRODUCE', 'DAIRY', 'MEAT', 'PANTRY', 'SPICES', 'FROZEN']);
export const kosherType = z.enum(['MEAT', 'DAIRY', 'PAREVE']);

export const listIngredientsQuery = z.object({
  category: department.optional(),
  q: z.string().trim().max(40).optional(),
});

export const createIngredientSchema = z.object({
  name: z.string().trim().min(1, 'חסר שם מצרך').max(40),
  category: department,
  unit: z.string().trim().min(1, 'חסרה יחידה').max(15),
  kosherType: kosherType.default('PAREVE'),
  needsInspection: z.boolean().default(false),
  inStock: z.boolean().default(false),
});

export const updateIngredientSchema = createIngredientSchema.omit({ inStock: true }).partial();
