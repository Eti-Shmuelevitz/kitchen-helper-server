import type { Meal } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../db/prisma';
import type { AuthUser } from '../../auth/types';
import { DAY_NAMES, addDays, dayOfWeek, fromDbDate, getWeekStart, toDbDate, todayIso } from '../../utils/dates';
import { badRequest, conflict, notFound } from '../../utils/httpError';
import { getWeekCalendar, isYomTov } from '../../utils/hebcal';
import { checkMixedMeal } from '../../utils/kitchen';
import { MEAL_LABELS, SHABBAT_MEALS, WEEKDAY_MEALS } from '../../utils/labels';
import { imageUrl } from '../recipes/recipes.context';
import type { createEntrySchema, menuQuery, updateEntrySchema } from './menu.schemas';

/** אילו ארוחות מותרות בתאריך: בשבת רק סעודות שבת, וסעודת חג רק ביום טוב */
export function allowedMeals(date: string, yomTov = isYomTov(date)): Meal[] {
  const base = dayOfWeek(date) === 6 ? [...SHABBAT_MEALS] : [...WEEKDAY_MEALS];
  return yomTov ? [...base, 'YOM_TOV'] : base;
}

function assertMealAllowed(date: string, meal: Meal) {
  if (!allowedMeals(date).includes(meal)) {
    const msg =
      dayOfWeek(date) === 6
        ? 'ביום שבת משבצים רק לסעודות השבת'
        : SHABBAT_MEALS.includes(meal)
          ? 'סעודות שבת אפשר לשבץ רק ביום שבת'
          : 'סעודת חג אפשר לשבץ רק ביום טוב';
    throw badRequest(msg, [{ field: 'meal', message: msg }]);
  }
}

const entryInclude = {
  recipe: { select: { id: true, name: true, kosherType: true, color: true, status: true, prepMinutes: true, image: { select: { updatedAt: true } } } },
  addedBy: { select: { id: true, name: true } },
} as const;

type EntryRow = Awaited<ReturnType<typeof loadEntries>>[number];

function loadEntries(householdId: string, from: string, to: string) {
  return prisma.menuEntry.findMany({
    where: { householdId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
    include: entryInclude,
    orderBy: [{ date: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
  });
}

function shapeEntry(e: EntryRow) {
  return {
    id: e.id,
    date: fromDbDate(e.date),
    meal: e.meal,
    servings: e.servings,
    order: e.order,
    recipe: {
      id: e.recipe.id,
      name: e.recipe.name,
      kosherType: e.recipe.kosherType,
      color: e.recipe.color,
      status: e.recipe.status,
      prepMinutes: e.recipe.prepMinutes,
      imageUrl: imageUrl(e.recipe),
    },
    addedBy: e.addedBy,
  };
}

/** התפריט השבועי: ימי השבוע וסעודות השבת, עם תאריך עברי, פרשה וסימון ארוחה מעורבת */
export async function getWeek(user: AuthUser, q: z.infer<typeof menuQuery>) {
  const weekStart = getWeekStart(q.week ?? todayIso());
  const weekEnd = addDays(weekStart, 6);
  const cal = getWeekCalendar(weekStart);
  const entries = (await loadEntries(user.householdId, weekStart, weekEnd)).map(shapeEntry);
  const today = todayIso();
  let mixedMeals = 0;
  const days = cal.days.map((d) => {
    const dayEntries = entries.filter((e) => e.date === d.date);
    const mealList = allowedMeals(d.date, d.isYomTov);
    for (const e of dayEntries) if (!mealList.includes(e.meal)) mealList.push(e.meal);
    const meals = mealList.map((meal) => {
      const list = dayEntries.filter((e) => e.meal === meal);
      const mixed = checkMixedMeal(list.map((e) => e.recipe.kosherType));
      if (mixed) mixedMeals++;
      return { meal, label: MEAL_LABELS[meal], mixed, entries: list };
    });
    return { ...d, dayName: DAY_NAMES[d.dayOfWeek], isToday: d.date === today, meals };
  });
  return { weekStart, weekEnd, parasha: cal.parasha, candleLighting: cal.candleLighting, havdalah: cal.havdalah, mixedMeals, days };
}

async function mealStatus(householdId: string, date: string, meal: Meal) {
  const list = await prisma.menuEntry.findMany({ where: { householdId, date: toDbDate(date), meal }, include: { recipe: { select: { kosherType: true } } } });
  return { mealEntries: list.length, mixed: checkMixedMeal(list.map((e) => e.recipe.kosherType)) };
}

export async function addEntry(user: AuthUser, input: z.infer<typeof createEntrySchema>) {
  assertMealAllowed(input.date, input.meal);
  const recipe = await prisma.recipe.findFirst({ where: { id: input.recipeId, householdId: user.householdId } });
  if (!recipe) throw notFound('המתכון לא נמצא');
  if (recipe.status !== 'ACTIVE') throw conflict('אי אפשר לשבץ מתכון שבארכיון');
  const last = await prisma.menuEntry.findFirst({
    where: { householdId: user.householdId, date: toDbDate(input.date), meal: input.meal },
    orderBy: { order: 'desc' },
  });
  const e = await prisma.menuEntry.create({
    data: {
      householdId: user.householdId,
      date: toDbDate(input.date),
      meal: input.meal,
      recipeId: recipe.id,
      servings: input.servings ?? recipe.servings,
      order: (last?.order ?? -1) + 1,
      addedById: user.id,
    },
    include: entryInclude,
  });
  return { ...shapeEntry(e), ...(await mealStatus(user.householdId, input.date, input.meal)) };
}

/** הזזה אחרי גרירה: תאריך, ארוחה או מקום ברשימה. אפשר גם לשנות מספר מנות */
export async function updateEntry(user: AuthUser, id: string, input: z.infer<typeof updateEntrySchema>) {
  const e = await prisma.menuEntry.findFirst({ where: { id, householdId: user.householdId } });
  if (!e) throw notFound('השיבוץ לא נמצא');
  const date = input.date ?? fromDbDate(e.date);
  const meal = input.meal ?? e.meal;
  if (input.date || input.meal) assertMealAllowed(date, meal);
  const updated = await prisma.menuEntry.update({
    where: { id },
    data: { date: toDbDate(date), meal, ...(input.servings ? { servings: input.servings } : {}), ...(input.order !== undefined ? { order: input.order } : {}) },
    include: entryInclude,
  });
  return { ...shapeEntry(updated), ...(await mealStatus(user.householdId, date, meal)) };
}

export async function removeEntry(user: AuthUser, id: string) {
  const { count } = await prisma.menuEntry.deleteMany({ where: { id, householdId: user.householdId } });
  if (!count) throw notFound('השיבוץ לא נמצא');
}

/** המנות של תאריך מסוים (לדף הבית) */
export async function entriesOn(householdId: string, date: string) {
  return (await loadEntries(householdId, date, date)).map(shapeEntry);
}
