import { prisma } from '../../db/prisma';
import { isManager } from '../../auth/permissions';
import type { AuthUser } from '../../auth/types';
import { DAY_NAMES, addDays, dayOfWeek, getWeekStart, toDbDate, todayIso } from '../../utils/dates';
import { getHebrewDate, getWeekCalendar } from '../../utils/hebcal';
import { topVoted } from '../../utils/kitchen';
import { MEAL_LABELS, SHABBAT_MEALS } from '../../utils/labels';
import { entriesOn } from '../menu/menu.service';
import { activeCards, loadContext } from '../recipes/recipes.context';
import { listRequests, needsForMenu } from '../shopping/shopping.service';
import { list as listTasks } from '../tasks/tasks.service';

/**
 * getTodaySummary: כל הנתונים של דף הבית בבקשה אחת.
 * מיום רביעי מתווסף פס ״לקראת שבת קודש״.
 */
export async function getTodaySummary(user: AuthUser) {
  const today = todayIso();
  const dow = dayOfWeek(today);
  const ctx = await loadContext(user);
  const [todayEntries, cards, unread] = await Promise.all([
    entriesOn(user.householdId, today),
    activeCards(user, ctx),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  const readyNow = cards.filter((c) => c.canMakeNow).sort((a, b) => a.prepMinutes - b.prepMinutes).slice(0, 6);
  const missingOne = cards
    .filter((c) => c.missing.length === 1)
    .slice(0, 6)
    .map((c) => ({ ...c, missingIngredient: c.missing[0] }));

  let shabbat = null;
  if (dow >= 3 && dow <= 5) {
    const saturday = addDays(getWeekStart(today), 6);
    const friday = addDays(saturday, -1);
    const cal = getWeekCalendar(getWeekStart(today));
    const satEntries = await entriesOn(user.householdId, saturday);
    const tasks = await prisma.task.findMany({
      where: {
        householdId: user.householdId,
        isErevShabbat: true,
        dueDate: { gte: toDbDate(addDays(friday, -2)), lte: toDbDate(friday) },
        ...(isManager(user) ? {} : { assignedToId: user.id }),
      },
      include: { assignedTo: { select: { id: true, name: true, color: true } } },
      orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
    });
    shabbat = {
      date: saturday,
      hebrewDate: getHebrewDate(saturday),
      parasha: cal.parasha,
      candleLighting: cal.candleLighting.find((c) => c.date === friday) ?? cal.candleLighting[0] ?? null,
      havdalah: cal.havdalah.find((c) => c.date === saturday) ?? cal.havdalah[0] ?? null,
      meals: SHABBAT_MEALS.map((meal) => ({ meal, label: MEAL_LABELS[meal], entries: satEntries.filter((e) => e.meal === meal) })),
      missing: await needsForMenu(user.householdId, saturday, saturday),
      shabbatFriendlySuggestions: cards.filter((c) => c.shabbatFriendly).slice(0, 6),
      tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null, assignedTo: t.assignedTo })),
    };
  }

  const base = {
    date: today,
    dayName: DAY_NAMES[dow],
    hebrewDate: getHebrewDate(today),
    unreadNotifications: unread,
    todayMenu: todayEntries,
    readyNow,
    missingOne,
    shabbat,
  };

  if (isManager(user)) {
    const requests = (await listRequests(user)).filter((r) => r.status === 'PENDING');
    return { ...base, role: 'MANAGER' as const, pendingRequests: requests, topVoted: topVoted(cards, 3) };
  }
  const myTasks = await listTasks(user, { status: 'OPEN', sort: 'dueDate', order: 'asc', page: 1, pageSize: 10 });
  return { ...base, role: 'MEMBER' as const, myOpenTasks: myTasks.items };
}
