import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

/** createNotification: התראה בפעמון לאחד או יותר ממשתמשי הבית */
export async function createNotification(
  userIds: string[],
  type: NotificationType,
  text: string,
  link?: string,
  db: Db = prisma,
): Promise<void> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, type, text, link })) });
}

/** מזהי כל המנהלות של הבית (למשל כדי להודיע על בקשה חדשה) */
export async function managerIds(householdId: string, db: Db = prisma): Promise<string[]> {
  const rows = await db.user.findMany({ where: { householdId, role: 'MANAGER' }, select: { id: true } });
  return rows.map((r) => r.id);
}
