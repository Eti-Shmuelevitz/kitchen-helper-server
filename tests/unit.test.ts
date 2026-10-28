import { describe, expect, it } from 'vitest';
import { aggregateNeeds, buildWheelPool, calculateMatch, checkMixedMeal, countStars, scaleQuantity, topVoted } from '../src/utils/kitchen';
import { addDays, getWeekDates, getWeekStart } from '../src/utils/dates';
import { getHebrewDate, getParasha, getWeekCalendar, isShabbatOrYomTov, isYomTov } from '../src/utils/hebcal';

describe('חישובים', () => {
  it('calculateMatch: מצרך אופציונלי לא נספר', () => {
    const r = {
      ingredients: [
        { ingredientId: 'a', name: 'עגבניות', isOptional: false },
        { ingredientId: 'b', name: 'פלפל', isOptional: false },
        { ingredientId: 'c', name: 'פטרוזיליה', isOptional: true },
      ],
    };
    expect(calculateMatch(r, new Set(['a']))).toEqual({ have: 1, total: 2, percent: 50, missing: ['פלפל'], canMakeNow: false });
    expect(calculateMatch(r, new Set(['a', 'b'])).canMakeNow).toBe(true);
  });

  it('scaleQuantity: מעגל ל־2 ספרות, ו־0 נשאר ״לפי הטעם״', () => {
    expect(scaleQuantity(3, 4, 6)).toBe(4.5);
    expect(scaleQuantity(1, 3, 1)).toBe(0.33);
    expect(scaleQuantity(0, 4, 8)).toBe(0);
  });

  it('checkMixedMeal: בשרי וחלבי באותה ארוחה', () => {
    expect(checkMixedMeal(['MEAT', 'PAREVE'])).toBe(false);
    expect(checkMixedMeal(['MEAT', 'DAIRY'])).toBe(true);
  });

  it('buildWheelPool: ״ממה שיש״, ונפילה לכל המתכונים כשיש פחות מ־2', () => {
    const recipes = [{ missing: [] }, { missing: ['x', 'y'] }, { missing: ['z'] }, { missing: ['a', 'b', 'c'] }];
    const ready = buildWheelPool(recipes, 'ready', () => 0.5);
    expect(ready.usedFallback).toBe(false);
    expect(ready.items).toHaveLength(2);
    const fallback = buildWheelPool([{ missing: [] }, { missing: ['a', 'b'] }], 'ready');
    expect(fallback.usedFallback).toBe(true);
    expect(fallback.items).toHaveLength(2);
    expect(buildWheelPool(Array.from({ length: 15 }, () => ({ missing: [] })), 'all').items).toHaveLength(10);
  });

  it('topVoted: לפי מספר הצבעות, ובתיקו לפי א״ב', () => {
    const r = [
      { name: 'ב', votesThisWeek: 2 },
      { name: 'א', votesThisWeek: 2 },
      { name: 'ג', votesThisWeek: 5 },
      { name: 'ד', votesThisWeek: 0 },
    ];
    expect(topVoted(r).map((x) => x.name)).toEqual(['ג', 'א', 'ב']);
  });

  it('countStars: כוכב על כל משימה שהושלמה', () => {
    expect(
      countStars([
        { assignedToId: 'u1', status: 'DONE' },
        { assignedToId: 'u1', status: 'DONE' },
        { assignedToId: 'u2', status: 'OPEN' },
      ]),
    ).toEqual({ u1: 2 });
  });

  it('aggregateNeeds: מסכם אותו מצרך ומדלג על מה שיש בבית', () => {
    const lines = [
      { ingredientId: 'egg', name: 'ביצים', category: 'DAIRY', unit: 'יח׳', quantity: 4, recipe: 'קוגל' },
      { ingredientId: 'egg', name: 'ביצים', category: 'DAIRY', unit: 'יח׳', quantity: 6, recipe: 'שקשוקה' },
      { ingredientId: 'salt', name: 'מלח', category: 'SPICES', unit: 'כפית', quantity: 1, recipe: 'קוגל' },
    ];
    expect(aggregateNeeds(lines, new Set(['salt']))).toEqual([
      { ingredientId: 'egg', name: 'ביצים', category: 'DAIRY', unit: 'יח׳', quantity: 10, forRecipes: ['קוגל', 'שקשוקה'] },
    ]);
  });
});

describe('תאריכים ולוח עברי', () => {
  it('השבוע מתחיל ביום ראשון', () => {
    expect(getWeekStart('2026-10-22')).toBe('2026-10-18');
    expect(getWeekStart('2026-10-18')).toBe('2026-10-18');
    expect(getWeekDates('2026-10-18')).toHaveLength(7);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('תאריך עברי ופרשת השבוע', () => {
    expect(getHebrewDate('2026-10-24')).toBe('י״ג חשון תשפ״ז');
    expect(getParasha('2026-10-24')).toBe('פרשת לך־לך');
  });

  it('חגים: שמיני עצרת הוא יום טוב, חול המועד לא', () => {
    expect(isYomTov('2026-10-03')).toBe(true);
    expect(isYomTov('2026-09-30')).toBe(false);
    const cal = getWeekCalendar('2026-09-27');
    expect(cal.holidayDates).toEqual(['2026-10-03']);
    expect(cal.parasha).toBeNull(); // שבת שהיא חג
  });

  it('isShabbatOrYomTov: סגור מהדלקת נרות ועד הבדלה (זמני ירושלים)', () => {
    // שישי 23.10.2026: הדלקת נרות 17:18, הבדלה במוצאי שבת 18:34 (שעון ישראל, UTC+3)
    expect(isShabbatOrYomTov(new Date('2026-10-23T12:00:00Z')).closed).toBe(false);
    const sh = isShabbatOrYomTov(new Date('2026-10-23T16:00:00Z'));
    expect(sh.closed).toBe(true);
    expect(sh.reopensAtLocal).toBe('18:34');
    expect(isShabbatOrYomTov(new Date('2026-10-24T12:00:00Z')).closed).toBe(true);
    expect(isShabbatOrYomTov(new Date('2026-10-24T16:00:00Z')).closed).toBe(false);
    // ראש השנה תשפ״ז חל בשבת ובראשון: סגור גם ביום ראשון
    expect(isShabbatOrYomTov(new Date('2026-09-13T10:00:00Z')).closed).toBe(true);
    expect(isShabbatOrYomTov(new Date('2026-10-20T10:00:00Z')).closed).toBe(false);
  });
});
