import type { z } from 'zod';
import { prisma } from '../../db/prisma';
import { can } from '../../auth/permissions';
import type { AuthUser } from '../../auth/types';
import { forbidden, notFound } from '../../utils/httpError';
import { DEPARTMENT_LABELS, DEPARTMENT_ORDER } from '../../utils/labels';
import type { updatePantrySchema } from './pantry.schemas';

/** כל המצרכים של הבית עם יש / אין, מקובצים לפי מחלקות */
export async function getPantry(user: AuthUser) {
  const rows = await prisma.ingredient.findMany({
    where: { householdId: user.householdId },
    include: { pantryItem: { include: { updatedBy: { select: { id: true, name: true } } } } },
    orderBy: { name: 'asc' },
  });
  const groups = DEPARTMENT_ORDER.map((category) => {
    const items = rows
      .filter((r) => r.category === category)
      .map((r) => ({
        ingredientId: r.id,
        name: r.name,
        unit: r.unit,
        kosherType: r.kosherType,
        needsInspection: r.needsInspection,
        inStock: r.pantryItem?.inStock ?? false,
        updatedAt: r.pantryItem?.updatedAt ?? null,
        updatedBy: r.pantryItem?.updatedBy ?? null,
      }));
    return { category, label: DEPARTMENT_LABELS[category], inStockCount: items.filter((i) => i.inStock).length, items };
  });
  return { inStockCount: rows.filter((r) => r.pantryItem?.inStock).length, total: rows.length, groups };
}

/**
 * עדכון יש / אין. בן משפחה יכול רק לסמן ״נגמר״.
 * מצרך שסומן ״נגמר״ נכנס לרשימת הקניות (אם הוא עוד לא שם).
 */
export async function setInStock(user: AuthUser, ingredientId: string, input: z.infer<typeof updatePantrySchema>) {
  if (input.inStock && !can(user, 'pantry:markInStock')) throw forbidden('בן משפחה יכול לסמן רק ״נגמר״. סימון ״יש בבית״ נעשה דרך ״סיימתי לקנות״');
  const ingredient = await prisma.ingredient.findFirst({ where: { id: ingredientId, householdId: user.householdId } });
  if (!ingredient) throw notFound('המצרך לא נמצא');
  return prisma.$transaction(async (tx) => {
    const item = await tx.pantryItem.upsert({
      where: { ingredientId },
      create: { householdId: user.householdId, ingredientId, inStock: input.inStock, updatedById: user.id },
      update: { inStock: input.inStock, updatedById: user.id },
    });
    let addedToShopping = false;
    if (!input.inStock) {
      const open = await tx.shoppingItem.findFirst({
        where: { householdId: user.householdId, ingredientId, source: { not: 'AUTO' }, status: { in: ['OPEN', 'PENDING'] } },
      });
      if (!open) {
        await tx.shoppingItem.create({
          data: { householdId: user.householdId, source: 'MANUAL', status: 'OPEN', name: ingredient.name, category: ingredient.category, unit: ingredient.unit, ingredientId, requestedById: user.id },
        });
        addedToShopping = true;
      }
    }
    return { ingredientId, name: ingredient.name, inStock: item.inStock, updatedAt: item.updatedAt, addedToShopping };
  });
}
