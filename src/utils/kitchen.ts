import type { KosherType } from '@prisma/client';

// חישובים ״טהורים״ (בלי מסד נתונים), כדי שיהיה קל לבדוק אותם

export interface MatchInput {
  ingredients: { ingredientId: string; name: string; isOptional: boolean }[];
}

export interface Match {
  have: number;
  total: number;
  percent: number;
  missing: string[];
  canMakeNow: boolean;
}

/** calculateMatch: כמה ממצרכי המתכון יש בבית. מצרך אופציונלי לא נספר */
export function calculateMatch(recipe: MatchInput, inStock: Set<string>): Match {
  const required = recipe.ingredients.filter((i) => !i.isOptional);
  const missing = required.filter((i) => !inStock.has(i.ingredientId)).map((i) => i.name);
  const total = required.length;
  const have = total - missing.length;
  return { have, total, percent: total === 0 ? 100 : Math.round((have / total) * 100), missing, canMakeNow: missing.length === 0 };
}

/** scaleQuantity: כמות לפי מספר מנות, מעוגלת ל־2 ספרות. 0 (״לפי הטעם״) נשאר 0 */
export function scaleQuantity(quantity: number, fromServings: number, toServings: number): number {
  if (quantity === 0 || fromServings <= 0) return quantity;
  return Math.round(((quantity * toServings) / fromServings) * 100) / 100;
}

/** checkMixedMeal: האם באותה ארוחה יש גם מנה בשרית וגם מנה חלבית (סימון לתשומת לב בלבד) */
export function checkMixedMeal(kosherTypes: KosherType[]): boolean {
  return kosherTypes.includes('MEAT') && kosherTypes.includes('DAIRY');
}

/** ערבוב אקראי (Fisher-Yates). אפשר להעביר random לבדיקות */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * buildWheelPool: מתכונים לגלגל.
 * ״ממה שיש״: מתכונים שחסר להם לכל היותר מצרך אחד. פחות מ־2 תוצאות → כל המתכונים.
 */
export function buildWheelPool<T extends { missing: string[] }>(recipes: T[], mode: 'ready' | 'all', random: () => number = Math.random) {
  let pool = recipes;
  let usedFallback = false;
  if (mode === 'ready') {
    pool = recipes.filter((r) => r.missing.length <= 1);
    if (pool.length < 2) {
      pool = recipes;
      usedFallback = true;
    }
  }
  return { usedFallback, items: shuffle(pool, random).slice(0, 10) };
}

/** topVotedRecipes: המנות שהכי הרבה בני משפחה ביקשו. בתיקו: לפי א״ב */
export function topVoted<T extends { name: string; votesThisWeek: number }>(recipes: T[], n = 3): T[] {
  return recipes
    .filter((r) => r.votesThisWeek > 0)
    .sort((a, b) => b.votesThisWeek - a.votesThisWeek || a.name.localeCompare(b.name, 'he'))
    .slice(0, n);
}

/** countStars: כוכב אחד על כל משימה שהושלמה */
export function countStars(tasks: { assignedToId: string; status: 'OPEN' | 'DONE' }[]): Record<string, number> {
  const stars: Record<string, number> = {};
  for (const t of tasks) if (t.status === 'DONE') stars[t.assignedToId] = (stars[t.assignedToId] ?? 0) + 1;
  return stars;
}

export interface NeedLine {
  ingredientId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  recipe: string;
}

export interface AggregatedNeed {
  ingredientId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  forRecipes: string[];
}

/**
 * חלק מ־buildShoppingList: מצרך שיש בבית לא נכנס.
 * אותו מצרך באותה יחידה מסוכם לשורה אחת, עם שמות המתכונים.
 */
export function aggregateNeeds(lines: NeedLine[], inStock: Set<string>): AggregatedNeed[] {
  const map = new Map<string, AggregatedNeed>();
  for (const l of lines) {
    if (inStock.has(l.ingredientId)) continue;
    const key = `${l.ingredientId}|${l.unit}`;
    const cur = map.get(key);
    if (cur) {
      cur.quantity = Math.round((cur.quantity + l.quantity) * 100) / 100;
      if (!cur.forRecipes.includes(l.recipe)) cur.forRecipes.push(l.recipe);
    } else {
      map.set(key, { ingredientId: l.ingredientId, name: l.name, category: l.category, unit: l.unit, quantity: l.quantity, forRecipes: [l.recipe] });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));
}
