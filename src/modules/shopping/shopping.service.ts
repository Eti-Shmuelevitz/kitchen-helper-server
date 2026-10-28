import type { Department, Prisma, ShoppingItem } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../db/prisma';
import { isManager } from '../../auth/permissions';
import type { AuthUser } from '../../auth/types';
import { createNotification, managerIds } from '../../services/notifications';
import { addDays, getWeekStart, toDbDate, todayIso } from '../../utils/dates';
import { conflict, notFound } from '../../utils/httpError';
import { aggregateNeeds, scaleQuantity, type AggregatedNeed } from '../../utils/kitchen';
import { DEPARTMENT_LABELS, DEPARTMENT_ORDER } from '../../utils/labels';
import type { addItemSchema, boughtSchema, reviewSchema } from './shopping.schemas';

const brief = { select: { id: true, name: true } } as const;

/**
 * מה צריך לקנות בשביל המנות שבתפריט בין שני תאריכים, פחות מה שיש בבית.
 * מצרך אופציונלי לא נכנס. הכמויות מחושבות לפי מספר המנות בשיבוץ.
 */
export async function needsForMenu(householdId: string, from: string, to: string): Promise<AggregatedNeed[]> {
  if (from > to) return [];
  const [entries, pantry] = await Promise.all([
    prisma.menuEntry.findMany({
      where: { householdId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
      include: { recipe: { include: { ingredients: { where: { isOptional: false }, include: { ingredient: true } } } } },
    }),
    prisma.pantryItem.findMany({ where: { householdId, inStock: true }, select: { ingredientId: true } }),
  ]);
  const lines = entries.flatMap((e) =>
    e.recipe.ingredients.map((ri) => ({
      ingredientId: ri.ingredientId,
      name: ri.ingredient.name,
      category: ri.ingredient.category,
      unit: ri.unit,
      quantity: scaleQuantity(ri.quantity, e.recipe.servings, e.servings),
      recipe: e.recipe.name,
    })),
  );
  return aggregateNeeds(lines, new Set(pantry.map((p) => p.ingredientId)));
}

type ItemRow = ShoppingItem & { requestedBy: { id: string; name: string } | null; boughtBy: { id: string; name: string } | null };

const itemInclude = { requestedBy: brief, boughtBy: brief, reviewedBy: brief } satisfies Prisma.ShoppingItemInclude;

function shapeItem(i: ItemRow, forRecipes: string[] = []) {
  return {
    key: i.id,
    id: i.id,
    source: i.source,
    status: i.status,
    name: i.name,
    category: i.category,
    quantity: i.quantity,
    unit: i.unit,
    ingredientId: i.ingredientId,
    forRecipes,
    requestedBy: i.requestedBy,
    boughtBy: i.boughtBy,
    createdAt: i.createdAt,
  };
}

/** buildShoppingList: פריטים מהתפריט + פריטים שנוספו ידנית + בקשות שאושרו, לפי מחלקות */
export async function getList(user: AuthUser, week?: string) {
  const today = todayIso();
  const weekStart = getWeekStart(week ?? today);
  const weekEnd = addDays(weekStart, 6);
  // ארוחות שכבר עברו לא נכנסות לרשימה
  const from = weekStart > today ? weekStart : today;
  const [needs, autoRows, rows] = await Promise.all([
    needsForMenu(user.householdId, from, weekEnd),
    prisma.shoppingItem.findMany({ where: { householdId: user.householdId, source: 'AUTO', weekStart: toDbDate(weekStart) }, include: itemInclude }),
    prisma.shoppingItem.findMany({
      where: { householdId: user.householdId, source: { not: 'AUTO' }, status: { in: ['OPEN', 'BOUGHT'] } },
      include: itemInclude,
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const items: ReturnType<typeof shapeItem>[] = rows.map((r) => shapeItem(r));
  const manualByIngredient = new Map(items.filter((i) => i.ingredientId).map((i) => [i.ingredientId!, i]));
  for (const n of needs) {
    const manual = manualByIngredient.get(n.ingredientId);
    if (manual) {
      // המצרך כבר ברשימה: לא מוסיפים שורה נוספת, רק מציינים לאילו מתכונים הוא נחוץ
      manual.forRecipes = n.forRecipes;
      continue;
    }
    const mark = autoRows.find((a) => a.ingredientId === n.ingredientId);
    items.push({
      key: `auto:${n.ingredientId}`,
      id: mark?.id ?? null!,
      source: 'AUTO',
      status: mark ? 'BOUGHT' : 'OPEN',
      name: n.name,
      category: n.category as Department,
      quantity: n.quantity,
      unit: n.unit,
      ingredientId: n.ingredientId,
      forRecipes: n.forRecipes,
      requestedBy: null,
      boughtBy: mark?.boughtBy ?? null,
      createdAt: mark?.createdAt ?? new Date(),
    });
  }

  const groups = DEPARTMENT_ORDER.map((category) => ({
    category,
    label: DEPARTMENT_LABELS[category],
    items: items.filter((i) => i.category === category).sort((a, b) => a.name.localeCompare(b.name, 'he')),
  })).filter((g) => g.items.length > 0);

  const bought = items.filter((i) => i.status === 'BOUGHT').length;
  return {
    weekStart,
    from,
    progress: { bought, total: items.length, percent: items.length ? Math.round((bought / items.length) * 100) : 0 },
    groups,
    requests: await listRequests(user),
  };
}

/** מנהלת רואה את כל הבקשות. בן משפחה רואה רק את שלו */
export async function listRequests(user: AuthUser) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const rows = await prisma.shoppingItem.findMany({
    where: {
      householdId: user.householdId,
      source: 'REQUEST',
      ...(isManager(user) ? {} : { requestedById: user.id }),
      OR: [{ status: 'PENDING' }, { createdAt: { gte: since } }],
    },
    include: itemInclude,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  return rows.map((r) => ({ ...shapeItem(r), reviewedBy: r.reviewedBy, reviewedAt: r.reviewedAt }));
}

/** מנהלת: פריט פתוח מיד. בן משפחה: בקשה שממתינה לאישור, והתראה למנהלות */
export async function addItem(user: AuthUser, input: z.infer<typeof addItemSchema>) {
  let ingredient = input.ingredientId
    ? await prisma.ingredient.findFirst({ where: { id: input.ingredientId, householdId: user.householdId } })
    : await prisma.ingredient.findFirst({ where: { householdId: user.householdId, name: input.name } });
  if (input.ingredientId && !ingredient) throw notFound('המצרך לא נמצא');
  ingredient = ingredient ?? null;
  const manager = isManager(user);
  return prisma.$transaction(async (tx) => {
    const item = await tx.shoppingItem.create({
      data: {
        householdId: user.householdId,
        source: manager ? 'MANUAL' : 'REQUEST',
        status: manager ? 'OPEN' : 'PENDING',
        name: ingredient?.name ?? input.name,
        category: ingredient?.category ?? input.category,
        quantity: input.quantity ?? null,
        unit: input.unit ?? ingredient?.unit ?? null,
        ingredientId: ingredient?.id ?? null,
        requestedById: user.id,
      },
      include: itemInclude,
    });
    if (!manager) {
      await createNotification(await managerIds(user.householdId, tx), 'SHOPPING_REQUEST', `${user.name} ביקש/ה: ${item.name}`, '/shopping', tx);
    }
    return shapeItem(item);
  });
}

/** אישור או דחייה של בקשה. בקשה שכבר טופלה → 409 */
export async function review(user: AuthUser, id: string, input: z.infer<typeof reviewSchema>) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.shoppingItem.findFirst({ where: { id, householdId: user.householdId, source: 'REQUEST' } });
    if (!item) throw notFound('הבקשה לא נמצאה');
    if (item.status !== 'PENDING') throw conflict('הבקשה הזו כבר טופלה');
    const approved = input.action === 'approve';
    const updated = await tx.shoppingItem.update({
      where: { id },
      data: { status: approved ? 'OPEN' : 'DECLINED', reviewedById: user.id, reviewedAt: new Date() },
      include: itemInclude,
    });
    if (item.requestedById) {
      await createNotification(
        [item.requestedById],
        approved ? 'REQUEST_APPROVED' : 'REQUEST_DECLINED',
        approved ? `הבקשה שלך אושרה: ${item.name}` : `הבקשה שלך לא אושרה הפעם: ${item.name}`,
        '/shopping',
        tx,
      );
    }
    return shapeItem(updated);
  });
}

/** סימון ״קניתי״ (או ביטול). פריט מהתפריט מזוהה לפי ingredientId */
export async function markBought(user: AuthUser, input: z.infer<typeof boughtSchema>) {
  if (input.itemId) {
    const item = await prisma.shoppingItem.findFirst({ where: { id: input.itemId, householdId: user.householdId } });
    if (!item) throw notFound('הפריט לא נמצא');
    if (item.status === 'PENDING' || item.status === 'DECLINED') throw conflict('אפשר לסמן ״קניתי״ רק על פריט שנמצא ברשימה');
    const updated = await prisma.shoppingItem.update({
      where: { id: item.id },
      data: input.bought ? { status: 'BOUGHT', boughtById: user.id, boughtAt: new Date() } : { status: 'OPEN', boughtById: null, boughtAt: null },
      include: itemInclude,
    });
    return shapeItem(updated);
  }
  const ingredient = await prisma.ingredient.findFirst({ where: { id: input.ingredientId!, householdId: user.householdId } });
  if (!ingredient) throw notFound('המצרך לא נמצא');
  const weekStart = toDbDate(getWeekStart(input.week ?? todayIso()));
  const existing = await prisma.shoppingItem.findFirst({ where: { householdId: user.householdId, source: 'AUTO', ingredientId: ingredient.id, weekStart } });
  if (!input.bought) {
    if (existing) await prisma.shoppingItem.delete({ where: { id: existing.id } });
    return { key: `auto:${ingredient.id}`, ingredientId: ingredient.id, name: ingredient.name, source: 'AUTO', status: 'OPEN' };
  }
  const row =
    existing ??
    (await prisma.shoppingItem.create({
      data: {
        householdId: user.householdId,
        source: 'AUTO',
        status: 'BOUGHT',
        name: ingredient.name,
        category: ingredient.category,
        unit: ingredient.unit,
        ingredientId: ingredient.id,
        weekStart,
        boughtById: user.id,
        boughtAt: new Date(),
      },
    }));
  return { key: `auto:${ingredient.id}`, id: row.id, ingredientId: ingredient.id, name: ingredient.name, source: 'AUTO', status: 'BOUGHT' };
}

/**
 * finishShopping: כל מה שסומן ״נקנה״ עובר ל״יש בבית״, ונמחק מהרשימה.
 * רץ כטרנזקציה אחת, כדי שלא יישמר חצי שינוי.
 */
export async function finish(user: AuthUser) {
  return prisma.$transaction(async (tx) => {
    const bought = await tx.shoppingItem.findMany({ where: { householdId: user.householdId, status: 'BOUGHT' } });
    const names = bought.filter((b) => !b.ingredientId).map((b) => b.name);
    const byName = names.length ? await tx.ingredient.findMany({ where: { householdId: user.householdId, name: { in: names } } }) : [];
    const ingredientIds = new Set<string>([...bought.flatMap((b) => (b.ingredientId ? [b.ingredientId] : [])), ...byName.map((i) => i.id)]);
    for (const ingredientId of ingredientIds) {
      await tx.pantryItem.upsert({
        where: { ingredientId },
        create: { householdId: user.householdId, ingredientId, inStock: true, updatedById: user.id },
        update: { inStock: true, updatedById: user.id },
      });
    }
    await tx.shoppingItem.deleteMany({ where: { id: { in: bought.map((b) => b.id) } } });
    // סימוני ״קניתי״ של שבועות קודמים כבר לא רלוונטיים
    await tx.shoppingItem.deleteMany({ where: { householdId: user.householdId, source: 'AUTO', weekStart: { lt: toDbDate(getWeekStart(todayIso())) } } });
    return {
      movedToPantry: ingredientIds.size,
      removedItems: bought.length,
      message: `${ingredientIds.size} מצרכים נכנסו למלאי`,
    };
  });
}

export async function removeItem(user: AuthUser, id: string) {
  const { count } = await prisma.shoppingItem.deleteMany({ where: { id, householdId: user.householdId } });
  if (!count) throw notFound('הפריט לא נמצא');
}
