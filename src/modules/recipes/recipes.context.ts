import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import type { AuthUser } from '../../auth/types';
import { getWeekStart, toDbDate, todayIso } from '../../utils/dates';
import { calculateMatch } from '../../utils/kitchen';
import { CATEGORY_LABELS, DIFFICULTY_LABELS, KOSHER_LABELS } from '../../utils/labels';

// מה שצריך כדי לחשב את השדות המחושבים של מתכון: מלאי, הצבעות השבוע ומועדפים

export const recipeCardInclude = {
  ingredients: { include: { ingredient: { select: { name: true } } } },
  image: { select: { updatedAt: true } },
} satisfies Prisma.RecipeInclude;

export type RecipeWithIngredients = Prisma.RecipeGetPayload<{ include: typeof recipeCardInclude }>;

export interface RecipeContext {
  inStock: Set<string>;
  votes: Map<string, number>;
  myVotes: Set<string>;
  favorites: Set<string>;
  weekStart: string;
}

export async function loadContext(user: AuthUser): Promise<RecipeContext> {
  const weekStart = getWeekStart(todayIso());
  const [pantry, votes, favs] = await Promise.all([
    prisma.pantryItem.findMany({ where: { householdId: user.householdId, inStock: true }, select: { ingredientId: true } }),
    prisma.vote.findMany({ where: { weekStart: toDbDate(weekStart), recipe: { householdId: user.householdId } }, select: { recipeId: true, userId: true } }),
    prisma.favorite.findMany({ where: { userId: user.id }, select: { recipeId: true } }),
  ]);
  const voteMap = new Map<string, number>();
  for (const v of votes) voteMap.set(v.recipeId, (voteMap.get(v.recipeId) ?? 0) + 1);
  return {
    inStock: new Set(pantry.map((p) => p.ingredientId)),
    votes: voteMap,
    myVotes: new Set(votes.filter((v) => v.userId === user.id).map((v) => v.recipeId)),
    favorites: new Set(favs.map((f) => f.recipeId)),
    weekStart,
  };
}

export const imageUrl = (r: { id: string; image?: { updatedAt: Date } | null }) =>
  r.image ? `/api/recipes/${r.id}/image?v=${r.image.updatedAt.getTime()}` : null;

/** כרטיס מתכון עם השדות המחושבים match, missing, canMakeNow, votesThisWeek, isFavorite */
export function toCard(r: RecipeWithIngredients, ctx: RecipeContext) {
  const m = calculateMatch(
    { ingredients: r.ingredients.map((i) => ({ ingredientId: i.ingredientId, name: i.ingredient.name, isOptional: i.isOptional })) },
    ctx.inStock,
  );
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    categoryLabel: CATEGORY_LABELS[r.category],
    kosherType: r.kosherType,
    kosherLabel: KOSHER_LABELS[r.kosherType],
    shabbatFriendly: r.shabbatFriendly,
    difficulty: r.difficulty,
    difficultyLabel: DIFFICULTY_LABELS[r.difficulty],
    prepMinutes: r.prepMinutes,
    servings: r.servings,
    color: r.color,
    status: r.status,
    imageUrl: imageUrl(r),
    match: { have: m.have, total: m.total, percent: m.percent },
    missing: m.missing,
    canMakeNow: m.canMakeNow,
    votesThisWeek: ctx.votes.get(r.id) ?? 0,
    votedByMe: ctx.myVotes.has(r.id),
    isFavorite: ctx.favorites.has(r.id),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export type RecipeCard = ReturnType<typeof toCard>;

/** כל המתכונים הפעילים של הבית ככרטיסים (לדף הבית, לגלגל ולמיון לפי התאמה) */
export async function activeCards(user: AuthUser, ctx?: RecipeContext): Promise<RecipeCard[]> {
  const c = ctx ?? (await loadContext(user));
  const rows = await prisma.recipe.findMany({ where: { householdId: user.householdId, status: 'ACTIVE' }, include: recipeCardInclude, orderBy: { name: 'asc' } });
  return rows.map((r) => toCard(r, c));
}
