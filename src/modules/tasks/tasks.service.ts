import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../db/prisma';
import { isManager } from '../../auth/permissions';
import type { AuthUser } from '../../auth/types';
import { createNotification, managerIds } from '../../services/notifications';
import { addDays, fromDbDate, getWeekStart, toDbDate, todayIso } from '../../utils/dates';
import { badRequest, forbidden, notFound } from '../../utils/httpError';
import { countStars } from '../../utils/kitchen';
import type { createTaskSchema, createTemplateSchema, erevShabbatSchema, listTasksQuery, updateTaskSchema } from './tasks.schemas';

const include = {
  assignedTo: { select: { id: true, name: true, color: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof include }>;

function shape(t: TaskRow) {
  const today = todayIso();
  const due = t.dueDate ? fromDbDate(t.dueDate) : null;
  return {
    id: t.id,
    title: t.title,
    dueDate: due,
    isOverdue: t.status === 'OPEN' && !!due && due < today,
    status: t.status,
    completedAt: t.completedAt,
    isErevShabbat: t.isErevShabbat,
    templateId: t.templateId,
    assignedTo: t.assignedTo,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

async function assertMember(householdId: string, userId: string) {
  const u = await prisma.user.findFirst({ where: { id: userId, householdId }, select: { id: true } });
  if (!u) throw badRequest('בן הבית שנבחר לא נמצא', [{ field: 'assignedToId', message: 'לא שייך לבית' }]);
}

/** מנהלת רואה את כל המשימות. בן משפחה רואה רק את שלו */
export async function list(user: AuthUser, q: z.infer<typeof listTasksQuery>) {
  const where: Prisma.TaskWhereInput = {
    householdId: user.householdId,
    ...(isManager(user) ? (q.assignedTo ? { assignedToId: q.assignedTo } : {}) : { assignedToId: user.id }),
    ...(q.status ? { status: q.status } : {}),
    ...(q.isErevShabbat !== undefined ? { isErevShabbat: q.isErevShabbat } : {}),
    ...(q.q ? { title: { contains: q.q, mode: 'insensitive' as const } } : {}),
  };
  const orderBy: Prisma.TaskOrderByWithRelationInput[] =
    q.sort === 'dueDate'
      ? [{ dueDate: { sort: q.order, nulls: 'last' } }, { createdAt: 'asc' }]
      : [{ [q.sort]: q.order }];
  const [total, rows] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({ where, include, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)), items: rows.map(shape) };
}

export async function create(user: AuthUser, input: z.infer<typeof createTaskSchema>) {
  await assertMember(user.householdId, input.assignedToId);
  return prisma.$transaction(async (tx) => {
    const t = await tx.task.create({
      data: {
        householdId: user.householdId,
        title: input.title,
        assignedToId: input.assignedToId,
        dueDate: input.dueDate ? toDbDate(input.dueDate) : null,
        isErevShabbat: input.isErevShabbat,
        createdById: user.id,
      },
      include,
    });
    if (input.assignedToId !== user.id) await createNotification([input.assignedToId], 'TASK_ASSIGNED', `משימה חדשה: ${t.title}`, '/tasks', tx);
    return shape(t);
  });
}

async function findOwn(user: AuthUser, id: string) {
  const t = await prisma.task.findFirst({ where: { id, householdId: user.householdId } });
  if (!t) throw notFound('המשימה לא נמצאה');
  return t;
}

export async function update(user: AuthUser, id: string, input: z.infer<typeof updateTaskSchema>) {
  const t = await findOwn(user, id);
  if (input.assignedToId) await assertMember(user.householdId, input.assignedToId);
  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(input.title ? { title: input.title } : {}),
      ...(input.assignedToId ? { assignedToId: input.assignedToId } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? toDbDate(input.dueDate) : null } : {}),
      ...(input.status ? { status: input.status, completedAt: input.status === 'DONE' ? (t.completedAt ?? new Date()) : null } : {}),
    },
    include,
  });
  if (input.assignedToId && input.assignedToId !== t.assignedToId && input.assignedToId !== user.id) {
    await createNotification([input.assignedToId], 'TASK_ASSIGNED', `משימה חדשה: ${updated.title}`, '/tasks');
  }
  return shape(updated);
}

export async function remove(user: AuthUser, id: string) {
  await findOwn(user, id);
  await prisma.task.delete({ where: { id } });
}

/** סימון ״סיימתי״ (או ביטול). בן משפחה רק על משימה שלו */
export async function toggle(user: AuthUser, id: string) {
  const t = await findOwn(user, id);
  if (!isManager(user) && t.assignedToId !== user.id) throw forbidden('אפשר לסמן רק משימה שלך');
  const done = t.status === 'OPEN';
  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id }, data: { status: done ? 'DONE' : 'OPEN', completedAt: done ? new Date() : null }, include });
    if (done && !isManager(user)) {
      await createNotification(await managerIds(user.householdId, tx), 'TASK_DONE', `${user.name} סיים/ה: ${t.title} ⭐`, '/tasks', tx);
    }
    return shape(updated);
  });
}

/** לוח כוכבי עזרה: כמה משימות כל אחד השלים */
export async function stars(user: AuthUser) {
  const [users, done] = await Promise.all([
    prisma.user.findMany({ where: { householdId: user.householdId }, select: { id: true, name: true, color: true } }),
    prisma.task.findMany({ where: { householdId: user.householdId, status: 'DONE' }, select: { assignedToId: true, status: true } }),
  ]);
  const s = countStars(done);
  return users.map((u) => ({ ...u, stars: s[u.id] ?? 0 })).sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name, 'he'));
}

// ---------- משימות קבועות לערב שבת ----------

const DAY_LABEL = ['יום שישי', 'יום חמישי', 'יום רביעי'];

export async function listTemplates(user: AuthUser) {
  const rows = await prisma.taskTemplate.findMany({
    where: { householdId: user.householdId },
    include: { defaultAssignee: { select: { id: true, name: true } } },
    orderBy: [{ daysBeforeShabbat: 'desc' }, { title: 'asc' }],
  });
  return rows.map((t) => ({ id: t.id, title: t.title, daysBeforeShabbat: t.daysBeforeShabbat, dayLabel: DAY_LABEL[t.daysBeforeShabbat], defaultAssignee: t.defaultAssignee }));
}

export async function createTemplate(user: AuthUser, input: z.infer<typeof createTemplateSchema>) {
  if (input.defaultAssigneeId) await assertMember(user.householdId, input.defaultAssigneeId);
  const t = await prisma.taskTemplate.create({
    data: { householdId: user.householdId, title: input.title, daysBeforeShabbat: input.daysBeforeShabbat, defaultAssigneeId: input.defaultAssigneeId ?? null },
    include: { defaultAssignee: { select: { id: true, name: true } } },
  });
  return { id: t.id, title: t.title, daysBeforeShabbat: t.daysBeforeShabbat, dayLabel: DAY_LABEL[t.daysBeforeShabbat], defaultAssignee: t.defaultAssignee };
}

export async function removeTemplate(user: AuthUser, id: string) {
  const { count } = await prisma.taskTemplate.deleteMany({ where: { id, householdId: user.householdId } });
  if (!count) throw notFound('המשימה הקבועה לא נמצאה');
}

/** יום שישי של השבוע הנוכחי */
export const fridayOfThisWeek = (today = todayIso()) => addDays(getWeekStart(today), 5);

/**
 * createErevShabbatTasks: יוצרת את המשימות הקבועות של השבוע הנוכחי.
 * למי: לפי מה שנשלח, ואם לא נשלח, לפי ברירת המחדל של המשימה הקבועה.
 * משימה שכבר נוצרה השבוע לא נוצרת שוב.
 */
export async function createErevShabbatTasks(user: AuthUser, input: z.infer<typeof erevShabbatSchema>) {
  const templates = await prisma.taskTemplate.findMany({ where: { householdId: user.householdId } });
  const friday = fridayOfThisWeek();
  const assignMap = new Map(input.assignments.map((a) => [a.templateId, a.assignedToId]));
  for (const a of input.assignments) {
    if (!templates.some((t) => t.id === a.templateId)) throw notFound('משימה קבועה לא נמצאה');
    await assertMember(user.householdId, a.assignedToId);
  }
  const created: ReturnType<typeof shape>[] = [];
  const skipped: { templateId: string; title: string; reason: string }[] = [];
  await prisma.$transaction(async (tx) => {
    for (const t of templates) {
      const assignedToId = assignMap.get(t.id) ?? t.defaultAssigneeId;
      if (!assignedToId) {
        skipped.push({ templateId: t.id, title: t.title, reason: 'לא נבחר למי' });
        continue;
      }
      const dueDate = toDbDate(addDays(friday, -t.daysBeforeShabbat));
      const exists = await tx.task.findFirst({ where: { templateId: t.id, dueDate } });
      if (exists) {
        skipped.push({ templateId: t.id, title: t.title, reason: 'כבר חולקה השבוע' });
        continue;
      }
      const task = await tx.task.create({
        data: { householdId: user.householdId, title: t.title, assignedToId, dueDate, isErevShabbat: true, templateId: t.id, createdById: user.id },
        include,
      });
      if (assignedToId !== user.id) await createNotification([assignedToId], 'TASK_ASSIGNED', `משימה לערב שבת: ${t.title}`, '/tasks', tx);
      created.push(shape(task));
    }
  });
  return { friday, created, skipped };
}
