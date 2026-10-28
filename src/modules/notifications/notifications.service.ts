import type { z } from 'zod';
import { prisma } from '../../db/prisma';
import type { AuthUser } from '../../auth/types';
import type { listNotificationsQuery, markReadSchema } from './notifications.schemas';

/** ההתראות שלי (50 האחרונות) ומספר שלא נקראו */
export async function list(user: AuthUser, q: z.infer<typeof listNotificationsQuery>) {
  const [unreadCount, items] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    prisma.notification.findMany({
      where: { userId: user.id, ...(q.unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, type: true, text: true, link: true, isRead: true, createdAt: true },
    }),
  ]);
  return { unreadCount, items };
}

/** סימון כנקרא: כולן, או רק המזהים שנשלחו */
export async function markRead(user: AuthUser, input: z.infer<typeof markReadSchema>) {
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false, ...(input.ids?.length ? { id: { in: input.ids } } : {}) },
    data: { isRead: true },
  });
}
