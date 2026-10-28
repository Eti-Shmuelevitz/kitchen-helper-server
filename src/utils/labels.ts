import type { Department, Difficulty, KosherType, Meal, RecipeCategory } from '@prisma/client';

// שמות בעברית לערכי הבחירה, כדי שהריאקט יוכל להציג אותם בלי לשכפל את הרשימות

export const DEPARTMENT_LABELS: Record<Department, string> = {
  PRODUCE: 'ירקות ופירות',
  DAIRY: 'חלב וביצים',
  MEAT: 'בשר, עוף ודגים',
  PANTRY: 'מזווה ויבשים',
  SPICES: 'תבלינים ורטבים',
  FROZEN: 'קפואים ואחר',
};
export const DEPARTMENT_ORDER = Object.keys(DEPARTMENT_LABELS) as Department[];

export const KOSHER_LABELS: Record<KosherType, string> = { MEAT: 'בשרי', DAIRY: 'חלבי', PAREVE: 'פרווה' };

export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  MAIN: 'מנה עיקרית',
  SIDE: 'תוספת',
  SALAD: 'סלט',
  SOUP: 'מרק',
  DESSERT: 'קינוח',
  BAKED: 'מאפה',
  BREAKFAST: 'ארוחת בוקר',
  SHABBAT_HOLIDAY: 'מנה לשבת ולחג',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { EASY: 'קל', MEDIUM: 'בינוני', HARD: 'מאתגר' };

export const MEAL_LABELS: Record<Meal, string> = {
  BREAKFAST: 'בוקר',
  LUNCH: 'צהריים',
  DINNER: 'ערב',
  SHABBAT_NIGHT: 'ליל שבת',
  SHABBAT_DAY: 'סעודת שבת',
  SEUDA_SHLISHIT: 'סעודה שלישית',
  YOM_TOV: 'סעודת חג',
};

export const WEEKDAY_MEALS: Meal[] = ['BREAKFAST', 'LUNCH', 'DINNER'];
export const SHABBAT_MEALS: Meal[] = ['SHABBAT_NIGHT', 'SHABBAT_DAY', 'SEUDA_SHLISHIT'];
