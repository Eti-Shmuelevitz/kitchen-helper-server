import { z } from 'zod';
import { boolQuery, color, page, pageSize } from '../../shared/schemas';
import { kosherType } from '../ingredients/ingredients.schemas';

export const recipeCategory = z.enum(['MAIN', 'SIDE', 'SALAD', 'SOUP', 'DESSERT', 'BAKED', 'BREAKFAST', 'SHABBAT_HOLIDAY']);
export const difficulty = z.enum(['EASY', 'MEDIUM', 'HARD']);
export const recipeStatus = z.enum(['ACTIVE', 'ARCHIVED']);

export const listRecipesQuery = z.object({
  q: z.string().trim().max(60).optional(),
  category: recipeCategory.optional(),
  kosherType: kosherType.optional(),
  difficulty: difficulty.optional(),
  maxMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  shabbatFriendly: boolQuery.optional(),
  ready: boolQuery.optional(),
  favorites: boolQuery.optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'ALL']).default('ACTIVE'),
  sort: z.enum(['name', 'prepMinutes', 'match', 'votes', 'createdAt']).default('name'),
  order: z.enum(['asc', 'desc']).optional(),
  page,
  pageSize,
});

export const recipeDetailQuery = z.object({ servings: z.coerce.number().int().min(1).max(50).optional() });

export const wheelQuery = z.object({ mode: z.enum(['ready', 'all']).default('ready') });

/**
 * מצרך במתכון: אפשר לבחור מצרך קיים לפי מזהה, או להקליד שם חופשי.
 * שם שלא קיים עדיין בבית נוצר אוטומטית כשהמתכון נשמר.
 */
const ingredientLine = z
  .object({
    ingredientId: z.string().uuid('מזהה מצרך לא תקין').optional(),
    name: z.string().trim().min(1, 'צריך לכתוב שם מצרך').max(40, 'שם מצרך של עד 40 תווים').optional(),
    quantity: z.number().min(0, 'כמות לא יכולה להיות שלילית').max(100000),
    unit: z.string().trim().min(1).max(15).optional(),
    isOptional: z.boolean().default(false),
  })
  .refine((l) => !!l.ingredientId || !!l.name, { message: 'צריך לכתוב שם מצרך', path: ['name'] });

const step = z.object({
  text: z.string().trim().min(2, 'שלב קצר מדי').max(500),
  timerMinutes: z.number().int().min(1).max(1440).nullable().optional(),
});

const recipeBase = z.object({
  name: z.string().trim().min(2, 'שם של 2 תווים לפחות').max(60, 'שם של עד 60 תווים'),
  description: z.string().trim().max(300).nullable().optional(),
  category: recipeCategory,
  kosherType,
  shabbatFriendly: z.boolean().default(false),
  difficulty,
  prepMinutes: z.number().int().min(1, 'זמן הכנה של דקה לפחות').max(1440),
  servings: z.number().int().min(1).max(50),
  color: color.nullable().optional(),
  ingredients: z
    .array(ingredientLine)
    .min(1, 'צריך לפחות מצרך אחד')
    .max(60),
  steps: z.array(step).min(1, 'צריך לפחות שלב אחד').max(40),
});

export const createRecipeSchema = recipeBase;
export const updateRecipeSchema = recipeBase.extend({ status: recipeStatus.optional() });
export const statusSchema = z.object({ status: recipeStatus });
