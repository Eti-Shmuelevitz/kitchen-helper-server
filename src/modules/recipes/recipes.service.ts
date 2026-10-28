import type { KosherType } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../db/prisma';
import { isManager } from '../../auth/permissions';
import type { AuthUser } from '../../auth/types';
import { toDbDate } from '../../utils/dates';
import { badRequest, conflict, HttpError, notFound } from '../../utils/httpError';
import { buildWheelPool, scaleQuantity } from '../../utils/kitchen';
import { KOSHER_LABELS } from '../../utils/labels';
import { activeCards, imageUrl, loadContext, recipeCardInclude, toCard, type RecipeCard } from './recipes.context';
import type { createRecipeSchema, listRecipesQuery, recipeDetailQuery, statusSchema, updateRecipeSchema } from './recipes.schemas';

type ListQuery = z.infer<typeof listRecipesQuery>;

/** רשימת מתכונים עם חיפוש, סינון, מיון וחלוקה לעמודים */
export async function list(user: AuthUser, q: ListQuery) {
  const ctx = await loadContext(user);
  // בן משפחה רואה רק מתכונים פעילים
  const status = isManager(user) ? q.status : 'ACTIVE';
  const rows = await prisma.recipe.findMany({
    where: {
      householdId: user.householdId,
      ...(status === 'ALL' ? {} : { status }),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' as const } } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.kosherType ? { kosherType: q.kosherType } : {}),
      ...(q.difficulty ? { difficulty: q.difficulty } : {}),
      ...(q.maxMinutes ? { prepMinutes: { lte: q.maxMinutes } } : {}),
      ...(q.shabbatFriendly !== undefined ? { shabbatFriendly: q.shabbatFriendly } : {}),
      ...(q.favorites ? { favorites: { some: { userId: user.id } } } : {}),
    },
    include: recipeCardInclude,
  });
  let cards = rows.map((r) => toCard(r, ctx));
  if (q.ready !== undefined) cards = cards.filter((c) => c.canMakeNow === q.ready);

  // כיוון ברירת מחדל: א״ב וזמן עולים, התאמה, הצבעות ותאריך יורדים
  const order = q.order ?? (q.sort === 'name' || q.sort === 'prepMinutes' ? 'asc' : 'desc');
  const dir = order === 'asc' ? 1 : -1;
  const byName = (a: RecipeCard, b: RecipeCard) => a.name.localeCompare(b.name, 'he');
  const key: Record<ListQuery['sort'], (a: RecipeCard, b: RecipeCard) => number> = {
    name: byName,
    prepMinutes: (a, b) => a.prepMinutes - b.prepMinutes,
    match: (a, b) => a.match.percent - b.match.percent,
    votes: (a, b) => a.votesThisWeek - b.votesThisWeek,
    createdAt: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  };
  cards.sort((a, b) => dir * key[q.sort](a, b) || byName(a, b));

  const total = cards.length;
  const start = (q.page - 1) * q.pageSize;
  return { total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)), items: cards.slice(start, start + q.pageSize) };
}

async function findOwn(user: AuthUser, id: string) {
  const r = await prisma.recipe.findFirst({ where: { id, householdId: user.householdId } });
  if (!r) throw notFound('המתכון לא נמצא');
  return r;
}

/** מתכון מלא, עם כמויות מחושבות לפי מספר המנות שביקשו */
export async function detail(user: AuthUser, id: string, q: z.infer<typeof recipeDetailQuery>) {
  const ctx = await loadContext(user);
  const r = await prisma.recipe.findFirst({
    where: { id, householdId: user.householdId },
    include: {
      ...recipeCardInclude,
      ingredients: { include: { ingredient: { select: { name: true, needsInspection: true, category: true } } } },
      steps: { orderBy: { order: 'asc' } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!r) throw notFound('המתכון לא נמצא');
  const servings = q.servings ?? r.servings;
  return {
    ...toCard(r, ctx),
    scaledServings: servings,
    createdBy: r.createdBy,
    ingredients: r.ingredients
      .map((i) => ({
        ingredientId: i.ingredientId,
        name: i.ingredient.name,
        category: i.ingredient.category,
        quantity: scaleQuantity(i.quantity, r.servings, servings),
        originalQuantity: i.quantity,
        unit: i.unit,
        isOptional: i.isOptional,
        toTaste: i.quantity === 0,
        inStock: ctx.inStock.has(i.ingredientId),
        needsInspection: i.ingredient.needsInspection,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he')),
    steps: r.steps.map((s) => ({ order: s.order, text: s.text, timerMinutes: s.timerMinutes })),
  };
}

type RecipeInput = z.infer<typeof createRecipeSchema>;

/**
 * מכין את שורות המצרכים והשלבים לשמירה.
 * מצרך עם מזהה: בודקים שהוא שייך לבית. מצרך עם שם: מוצאים אותו לפי השם, או יוצרים אותו.
 * סוג הכשרות של המתכון נקבע רק לפי מה שהמנהלת בחרה, בלי בדיקה לפי המצרכים.
 */
async function prepareLines(user: AuthUser, input: RecipeInput) {
  const ids = input.ingredients.filter((i) => i.ingredientId).map((i) => i.ingredientId!);
  const found = ids.length
    ? await prisma.ingredient.findMany({ where: { id: { in: ids }, householdId: user.householdId } })
    : [];
  if (found.length !== new Set(ids).size) {
    throw badRequest('יש מצרך שלא קיים ברשימת המצרכים של הבית', [{ field: 'ingredients', message: 'מצרך לא קיים' }]);
  }
  const byId = new Map(found.map((f) => [f.id, f]));

  const resolved: { ingredientId: string; quantity: number; unit: string; isOptional: boolean }[] = [];
  for (const line of input.ingredients) {
    let ing = line.ingredientId ? byId.get(line.ingredientId)! : null;
    if (!ing) {
      const name = line.name!.trim();
      ing =
        (await prisma.ingredient.findFirst({ where: { householdId: user.householdId, name } })) ??
        (await prisma.ingredient.create({
          data: { householdId: user.householdId, name, category: 'PANTRY', unit: line.unit ?? 'יחידות' },
        }));
    }
    resolved.push({ ingredientId: ing.id, quantity: line.quantity, unit: line.unit ?? ing.unit, isOptional: line.isOptional });
  }
  if (new Set(resolved.map((r) => r.ingredientId)).size !== resolved.length) {
    throw badRequest('אותו מצרך מופיע פעמיים', [{ field: 'ingredients', message: 'מצרך כפול' }]);
  }

  return {
    ingredients: resolved,
    steps: input.steps.map((s, idx) => ({ order: idx + 1, text: s.text, timerMinutes: s.timerMinutes ?? null })),
  };
}

async function assertNameFree(householdId: string, name: string, exceptId?: string) {
  const dup = await prisma.recipe.findFirst({ where: { householdId, name, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (dup) throw conflict('כבר יש מתכון בשם הזה');
}

export async function create(user: AuthUser, input: RecipeInput) {
  await assertNameFree(user.householdId, input.name);
  const lines = await prepareLines(user, input);
  const { ingredients: _i, steps: _s, ...fields } = input;
  const r = await prisma.recipe.create({
    data: {
      ...fields,
      householdId: user.householdId,
      createdById: user.id,
      ingredients: { create: lines.ingredients },
      steps: { create: lines.steps },
    },
  });
  return detail(user, r.id, {});
}

/** עדכון מלא: המצרכים והשלבים מוחלפים ברשימה החדשה, בפעולה אחת */
export async function update(user: AuthUser, id: string, input: z.infer<typeof updateRecipeSchema>) {
  await findOwn(user, id);
  await assertNameFree(user.householdId, input.name, id);
  const lines = await prepareLines(user, input);
  const { ingredients: _i, steps: _s, ...fields } = input;
  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
    prisma.recipeStep.deleteMany({ where: { recipeId: id } }),
    prisma.recipe.update({
      where: { id },
      data: { ...fields, ingredients: { create: lines.ingredients }, steps: { create: lines.steps } },
    }),
  ]);
  return detail(user, id, {});
}

/** פעיל או ארכיון. מתכון בארכיון לא מופיע בחיפוש, אבל נשאר בתפריטים ישנים */
export async function setStatus(user: AuthUser, id: string, input: z.infer<typeof statusSchema>) {
  await findOwn(user, id);
  await prisma.recipe.update({ where: { id }, data: { status: input.status } });
  return detail(user, id, {});
}

export async function vote(user: AuthUser, id: string) {
  const r = await findOwn(user, id);
  if (r.status !== 'ACTIVE') throw conflict('אי אפשר להצביע על מתכון בארכיון');
  const { weekStart } = await loadContext(user);
  const exists = await prisma.vote.findUnique({ where: { recipeId_userId_weekStart: { recipeId: id, userId: user.id, weekStart: toDbDate(weekStart) } } });
  if (exists) throw conflict('כבר ביקשת את המנה הזו השבוע');
  await prisma.vote.create({ data: { recipeId: id, userId: user.id, weekStart: toDbDate(weekStart) } });
  return { votesThisWeek: await prisma.vote.count({ where: { recipeId: id, weekStart: toDbDate(weekStart) } }), votedByMe: true };
}

export async function unvote(user: AuthUser, id: string) {
  await findOwn(user, id);
  const { weekStart } = await loadContext(user);
  await prisma.vote.deleteMany({ where: { recipeId: id, userId: user.id, weekStart: toDbDate(weekStart) } });
  return { votesThisWeek: await prisma.vote.count({ where: { recipeId: id, weekStart: toDbDate(weekStart) } }), votedByMe: false };
}

export async function favorite(user: AuthUser, id: string) {
  await findOwn(user, id);
  await prisma.favorite.upsert({ where: { recipeId_userId: { recipeId: id, userId: user.id } }, create: { recipeId: id, userId: user.id }, update: {} });
}

export async function unfavorite(user: AuthUser, id: string) {
  await findOwn(user, id);
  await prisma.favorite.deleteMany({ where: { recipeId: id, userId: user.id } });
}

/** הגלגל: עד 10 מתכונים, ממה שיש בבית או מכל המתכונים */
export async function wheel(user: AuthUser, mode: 'ready' | 'all') {
  const cards = await activeCards(user);
  const { items, usedFallback } = buildWheelPool(cards, mode);
  return { mode, usedFallback, items };
}

// ---------- תמונות ----------

const MAX_IMAGE = 2 * 1024 * 1024;

/** uploadImage: בודקת שזה באמת JPG או PNG (לפי תוכן הקובץ) עד 2MB, ושומרת במסד */
export async function uploadImage(user: AuthUser, id: string, file: { buffer: Buffer; size: number } | undefined) {
  await findOwn(user, id);
  if (!file) throw badRequest('לא נשלחה תמונה. שולחים קובץ בשדה image', [{ field: 'image', message: 'חסר קובץ' }]);
  if (file.size > MAX_IMAGE) throw badRequest('התמונה גדולה מ־2MB', [{ field: 'image', message: 'עד 2MB' }]);
  const b = file.buffer;
  const isPng = b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isJpg = b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (!isPng && !isJpg) throw badRequest('אפשר להעלות רק תמונה מסוג JPG או PNG', [{ field: 'image', message: 'JPG או PNG בלבד' }]);
  const mimeType = isPng ? 'image/png' : 'image/jpeg';
  const img = await prisma.recipeImage.upsert({
    where: { recipeId: id },
    create: { recipeId: id, mimeType, data: b },
    update: { mimeType, data: b },
    select: { updatedAt: true },
  });
  return { imageUrl: imageUrl({ id, image: img }) };
}

export async function removeImage(user: AuthUser, id: string) {
  await findOwn(user, id);
  await prisma.recipeImage.deleteMany({ where: { recipeId: id } });
}

/** התמונה עצמה. פתוחה בלי token, כדי שתגית img תוכל להציג אותה */
export async function getImage(id: string) {
  const img = await prisma.recipeImage.findUnique({ where: { recipeId: id } });
  if (!img) throw new HttpError(404, 'NOT_FOUND', 'אין תמונה למתכון');
  return img;
}
