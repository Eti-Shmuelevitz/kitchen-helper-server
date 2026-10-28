import type { z } from 'zod';
import { prisma } from '../../db/prisma';
import type { AuthUser } from '../../auth/types';
import { conflict, notFound } from '../../utils/httpError';
import { DEPARTMENT_LABELS } from '../../utils/labels';
import type { createIngredientSchema, listIngredientsQuery, updateIngredientSchema } from './ingredients.schemas';

const shape = (i: { id: string; name: string; category: keyof typeof DEPARTMENT_LABELS; unit: string; kosherType: string; needsInspection: boolean; pantryItem?: { inStock: boolean } | null }) => ({
  id: i.id,
  name: i.name,
  category: i.category,
  categoryLabel: DEPARTMENT_LABELS[i.category],
  unit: i.unit,
  kosherType: i.kosherType,
  needsInspection: i.needsInspection,
  inStock: i.pantryItem?.inStock ?? false,
});

export async function list(user: AuthUser, q: z.infer<typeof listIngredientsQuery>) {
  const rows = await prisma.ingredient.findMany({
    where: {
      householdId: user.householdId,
      ...(q.category ? { category: q.category } : {}),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' as const } } : {}),
    },
    include: { pantryItem: true },
    orderBy: { name: 'asc' },
  });
  return rows.map(shape);
}

async function assertNameFree(householdId: string, name: string, exceptId?: string) {
  const dup = await prisma.ingredient.findFirst({ where: { householdId, name, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (dup) throw conflict('כבר יש מצרך בשם הזה');
}

export async function create(user: AuthUser, input: z.infer<typeof createIngredientSchema>) {
  await assertNameFree(user.householdId, input.name);
  const { inStock, ...data } = input;
  const row = await prisma.ingredient.create({
    data: { ...data, householdId: user.householdId, pantryItem: { create: { householdId: user.householdId, inStock, updatedById: user.id } } },
    include: { pantryItem: true },
  });
  return shape(row);
}

export async function update(user: AuthUser, id: string, input: z.infer<typeof updateIngredientSchema>) {
  const existing = await prisma.ingredient.findFirst({ where: { id, householdId: user.householdId } });
  if (!existing) throw notFound('המצרך לא נמצא');
  if (input.name && input.name !== existing.name) await assertNameFree(user.householdId, input.name, id);
  return shape(await prisma.ingredient.update({ where: { id }, data: input, include: { pantryItem: true } }));
}
