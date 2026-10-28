import { z } from 'zod';

export const ingredientIdParam = z.object({ ingredientId: z.string().uuid('מזהה לא תקין') });
export const updatePantrySchema = z.object({ inStock: z.boolean({ required_error: 'חסר inStock' }) });
